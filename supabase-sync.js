(() => {
  const config = window.TAGESANKER_SUPABASE || {};
  const sessionKey = "tagesanker.supabase.session.v1";
  const dirtyKey = "tagesanker.cloud.dirty";
  const ownerKey = "tagesanker.cloud.owner";
  const configured = Boolean(config.url && config.anonKey);
  let session = readSession();
  let bridge = {};
  let syncChain = Promise.resolve();
  const status = document.querySelector("#sync-status");
  const authForm = document.querySelector("#auth-form");
  const signedIn = document.querySelector("#signed-in");
  const emailInput = document.querySelector("#auth-email");
  const passwordInput = document.querySelector("#auth-password");
  const authButtons = [document.querySelector("#sign-in-button"), document.querySelector("#sign-up-button")];

  function readSession() {
    try { return JSON.parse(localStorage.getItem(sessionKey)) || null; } catch { return null; }
  }

  function saveSession(nextSession) {
    session = nextSession;
    if (session) localStorage.setItem(sessionKey, JSON.stringify(session));
    else localStorage.removeItem(sessionKey);
    updateAuthView();
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function updateAuthView() {
    authForm.hidden = !configured || Boolean(session?.user?.id);
    signedIn.hidden = !configured || !session?.user?.id;
    if (session?.user?.email) document.querySelector("#signed-in-email").textContent = session.user.email;
  }

  function readableError(payload, fallback) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || fallback;
    if (/invalid login credentials/i.test(message)) return "E-Mail-Adresse oder Passwort stimmen nicht.";
    if (/email not confirmed/i.test(message)) return "Bitte bestätige zuerst den Link in deiner E-Mail.";
    if (/user already registered/i.test(message)) return "Für diese E-Mail-Adresse gibt es bereits ein Konto. Melde dich an.";
    if (/password should be at least/i.test(message)) return "Das Passwort ist zu kurz. Verwende mindestens 8 Zeichen.";
    return message;
  }

  async function request(path, { method = "GET", body, token, prefer } = {}) {
    const headers = { apikey: config.anonKey };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    if (prefer) headers.Prefer = prefer;
    const response = await fetch(`${config.url.replace(/\/$/, "")}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { message: text }; }
    if (!response.ok) throw new Error(readableError(payload, `Serverfehler (${response.status})`));
    return payload;
  }

  function createSession(payload) {
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: payload.expires_at || Math.floor(Date.now() / 1000) + (payload.expires_in || 3600),
      user: payload.user || session?.user || null
    };
  }

  async function getValidSession() {
    if (!session) return null;
    if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session;
    if (!session.refresh_token) {
      saveSession(null);
      return null;
    }
    try {
      const renewed = await request("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: { refresh_token: session.refresh_token }
      });
      saveSession(createSession(renewed));
      return session;
    } catch {
      saveSession(null);
      return null;
    }
  }

  function mergeStates(localState, remoteState) {
    const deletions = new Map();
    for (const deletion of [...(remoteState.deletedTasks || []), ...(localState.deletedTasks || [])]) {
      const previous = deletions.get(deletion.id);
      if (!previous || deletion.deletedAt > previous.deletedAt) deletions.set(deletion.id, deletion);
    }
    const tasks = new Map();
    for (const task of [...(remoteState.tasks || []), ...(localState.tasks || [])]) {
      const previous = tasks.get(task.id);
      if (!previous || (Number(task.updatedAt) || 0) > (Number(previous.updatedAt) || 0)) tasks.set(task.id, task);
    }
    const remainingTasks = [...tasks.values()].filter((task) => {
      const deletion = deletions.get(task.id);
      return !deletion || deletion.deletedAt < (Number(task.updatedAt) || 0);
    });
    return {
      points: Math.max(Number(localState.points) || 0, Number(remoteState.points) || 0),
      tasks: remainingTasks,
      deletedTasks: [...deletions.values()]
    };
  }

  async function syncNow() {
    const activeSession = await getValidSession();
    if (!activeSession?.user?.id) {
      updateAuthView();
      if (configured) setStatus("Melde dich an, um deinen Plan zwischen Geräten zu synchronisieren.");
      return;
    }

    setStatus("Dein Plan wird synchronisiert …");
    try {
      const accountId = activeSession.user.id;
      const previousAccountId = localStorage.getItem(ownerKey);
      if (previousAccountId && previousAccountId !== accountId) {
        bridge.setState({ points: 0, tasks: [], deletedTasks: [] });
        localStorage.removeItem(dirtyKey);
        await bridge.saveLocal();
      }
      localStorage.setItem(ownerKey, accountId);

      const userId = encodeURIComponent(accountId);
      const rows = await request(`/rest/v1/tagesanker_state?select=state&user_id=eq.${userId}`, { token: activeSession.access_token });
      const localState = bridge.getState();
      const hasUnsyncedChanges = localStorage.getItem(dirtyKey) === "true";
      let nextState;

      if (rows.length) {
        const remoteState = rows[0].state;
        nextState = hasUnsyncedChanges ? mergeStates(localState, remoteState) : remoteState;
      } else {
        nextState = localState;
      }

      bridge.setState(nextState);
      await bridge.saveLocal();

      if (!rows.length || hasUnsyncedChanges) {
        await request("/rest/v1/tagesanker_state?on_conflict=user_id", {
          method: "POST",
          token: activeSession.access_token,
          prefer: "resolution=merge-duplicates,return=minimal",
          body: [{ user_id: activeSession.user.id, state: nextState, updated_at: new Date().toISOString() }]
        });
      }

      localStorage.removeItem(dirtyKey);
      bridge.render();
      setStatus(`Synchronisiert mit ${activeSession.user.email}.`);
    } catch (error) {
      setStatus(`Lokal gespeichert. Cloud-Sync fehlgeschlagen: ${error.message}`);
    }
  }

  function sync() {
    syncChain = syncChain.catch(() => {}).then(syncNow);
    return syncChain;
  }

  function markDirty() {
    localStorage.setItem(dirtyKey, "true");
  }

  function setBusy(busy) {
    authButtons.forEach((button) => { button.disabled = busy; });
  }

  async function signIn(email, password) {
    setBusy(true);
    try {
      const payload = await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
      saveSession(createSession(payload));
      await sync();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function signUp(email, password) {
    setBusy(true);
    try {
      const redirectTo = `${location.origin}${location.pathname}`;
      const payload = await request(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST",
        body: { email, password }
      });
      if (payload.access_token) {
        saveSession(createSession(payload));
        await sync();
      } else {
        setStatus("Konto angelegt. Bestätige bitte den Link in deiner E-Mail und melde dich danach hier an.");
      }
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAuthCallback() {
    const params = new URLSearchParams(location.hash.slice(1));
    const accessToken = params.get("access_token");
    if (!accessToken) return;
    const callbackSession = {
      access_token: accessToken,
      refresh_token: params.get("refresh_token"),
      expires_at: Math.floor(Date.now() / 1000) + Number(params.get("expires_in") || 3600),
      user: null
    };
    saveSession(callbackSession);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    try {
      callbackSession.user = await request("/auth/v1/user", { token: accessToken });
      saveSession(callbackSession);
    } catch (error) {
      setStatus(`E-Mail bestätigt, Anmeldung noch nicht abgeschlossen: ${error.message}`);
    }
  }

  async function initialize(nextBridge) {
    bridge = nextBridge;
    if (!configured) {
      updateAuthView();
      setStatus("Cloud-Sync ist noch nicht eingerichtet. Deine lokale Speicherung funktioniert weiter.");
      return;
    }

    updateAuthView();
    await handleAuthCallback();
    if (session && !session.user?.id) {
      const activeSession = await getValidSession();
      if (activeSession) {
        try {
          activeSession.user = await request("/auth/v1/user", { token: activeSession.access_token });
          saveSession(activeSession);
        } catch { saveSession(null); }
      }
    }

    if (session?.user?.id) await sync();
    else {
      updateAuthView();
      setStatus("Melde dich an, um deinen Plan zwischen Geräten zu synchronisieren.");
    }
  }

  authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!authForm.reportValidity()) return;
    signIn(emailInput.value.trim(), passwordInput.value);
  });

  document.querySelector("#sign-up-button").addEventListener("click", () => {
    if (!authForm.reportValidity()) return;
    signUp(emailInput.value.trim(), passwordInput.value);
  });

  document.querySelector("#sign-out-button").addEventListener("click", async () => {
    const activeSession = await getValidSession();
    if (activeSession) {
      try { await request("/auth/v1/logout", { method: "POST", token: activeSession.access_token }); } catch { /* Local sign-out still works if the service is unavailable. */ }
    }
    saveSession(null);
    setStatus("Abgemeldet. Deine lokalen Daten bleiben auf diesem Gerät erhalten.");
  });

  document.querySelector("#sync-now-button").addEventListener("click", sync);
  window.addEventListener("online", sync);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });

  window.TagesankerCloud = {
    configured,
    initialize,
    markDirty,
    sync,
    isSignedIn: () => Boolean(session?.user?.id)
  };
  updateAuthView();
})();