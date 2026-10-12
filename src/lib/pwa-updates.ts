export type PwaUpdateState = "hidden" | "waiting" | "activating" | "reload-needed";

export type PwaUpdateWorker = {
  state: string;
  postMessage(message: { type: "SKIP_WAITING" }): void;
  addEventListener(type: "statechange", listener: EventListener): void;
  removeEventListener(type: "statechange", listener: EventListener): void;
};

export type PwaUpdateRegistration = {
  waiting: PwaUpdateWorker | null;
  installing: PwaUpdateWorker | null;
  update(): Promise<unknown>;
  addEventListener(type: "updatefound", listener: EventListener): void;
  removeEventListener(type: "updatefound", listener: EventListener): void;
};

export type PwaUpdateServiceWorkerContainer = {
  controller: PwaUpdateWorker | null;
  register(
    scriptURL: string,
    options: { scope: string; updateViaCache: "none" }
  ): Promise<PwaUpdateRegistration>;
  addEventListener(type: "controllerchange", listener: EventListener): void;
  removeEventListener(type: "controllerchange", listener: EventListener): void;
};

type PwaUpdateControllerOptions = {
  serviceWorker: PwaUpdateServiceWorkerContainer;
  canReload: () => boolean;
  reload: () => void;
  onStateChange: (state: PwaUpdateState) => void;
};

export class PwaUpdateController {
  private readonly serviceWorker: PwaUpdateServiceWorkerContainer;
  private readonly canReload: () => boolean;
  private readonly reload: () => void;
  private readonly onStateChange: (state: PwaUpdateState) => void;
  private registration: PwaUpdateRegistration | null = null;
  private waitingWorker: PwaUpdateWorker | null = null;
  private state: PwaUpdateState = "hidden";
  private activationRequested = false;
  private hadController = false;
  private started = false;
  private stopped = false;
  private observedWorkers = new Map<PwaUpdateWorker, EventListener>();

  constructor(options: PwaUpdateControllerOptions) {
    this.serviceWorker = options.serviceWorker;
    this.canReload = options.canReload;
    this.reload = options.reload;
    this.onStateChange = options.onStateChange;
  }

  get currentState() {
    return this.state;
  }

  async start() {
    if (this.started || this.stopped) return;
    this.started = true;
    this.hadController = this.serviceWorker.controller !== null;
    this.serviceWorker.addEventListener("controllerchange", this.handleControllerChange);

    try {
      const registration = await this.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      if (this.stopped) return;

      this.registration = registration;
      registration.addEventListener("updatefound", this.handleUpdateFound);
      this.observeInstallingWorker(registration.installing);
      this.syncWaitingWorker();
      await this.checkForUpdate();
    } catch {
      // Service worker registration is progressive enhancement; the online app remains usable.
    }
  }

  async checkForUpdate() {
    if (!this.registration || this.stopped) return;
    try {
      await this.registration.update();
      if (this.stopped) return;
      this.syncWaitingWorker();
    } catch {
      // Network and browser update errors are expected; a later visibility/online event retries.
    }
  }

  activateOrReload() {
    if (this.stopped || !this.canReload()) return false;

    if (this.state === "reload-needed") {
      this.setState("hidden");
      this.reload();
      return true;
    }

    const worker = this.waitingWorker ?? this.registration?.waiting ?? null;
    if (this.state !== "waiting" || !worker) return false;

    this.activationRequested = true;
    this.setState("activating");
    try {
      worker.postMessage({ type: "SKIP_WAITING" });
      return true;
    } catch {
      this.activationRequested = false;
      this.waitingWorker = worker;
      this.setState("waiting");
      return false;
    }
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.serviceWorker.removeEventListener("controllerchange", this.handleControllerChange);
    this.registration?.removeEventListener("updatefound", this.handleUpdateFound);
    this.observedWorkers.forEach((listener, worker) => {
      worker.removeEventListener("statechange", listener);
    });
    this.observedWorkers.clear();
    this.waitingWorker = null;
  }

  private readonly handleControllerChange: EventListener = () => {
    if (this.stopped) return;

    if (this.activationRequested) {
      this.activationRequested = false;
      this.waitingWorker = null;
      if (this.canReload()) {
        this.setState("hidden");
        this.reload();
      } else {
        this.setState("reload-needed");
      }
      return;
    }

    this.waitingWorker = null;
    // Another tab may activate a deployment while this tab still runs older JS.
    // Keep a manual reload cue, and never discard this tab's input automatically.
    if (this.hadController) this.setState("reload-needed");
    this.hadController = this.serviceWorker.controller !== null;
  };

  private readonly handleUpdateFound: EventListener = () => {
    this.observeInstallingWorker(this.registration?.installing ?? null);
  };

  private observeInstallingWorker(worker: PwaUpdateWorker | null) {
    if (!worker || this.observedWorkers.has(worker)) return;
    const onStateChange: EventListener = () => {
      if (this.stopped) return;
      if (worker.state === "installed") {
        if (this.serviceWorker.controller) {
          this.setWaitingWorker(this.registration?.waiting ?? worker);
        }
      } else if (worker.state === "redundant" && this.waitingWorker === worker) {
        this.waitingWorker = null;
        this.activationRequested = false;
        this.setState("hidden");
      } else if (
        this.waitingWorker === worker &&
        (worker.state === "activating" || worker.state === "activated") &&
        !this.activationRequested
      ) {
        this.waitingWorker = null;
        this.setState("hidden");
      }
    };

    this.observedWorkers.set(worker, onStateChange);
    worker.addEventListener("statechange", onStateChange);
    onStateChange(new Event("statechange"));
  }

  private syncWaitingWorker() {
    if (this.stopped || this.activationRequested) return;
    const waitingWorker = this.registration?.waiting;
    if (waitingWorker && this.serviceWorker.controller) {
      this.observeInstallingWorker(waitingWorker);
      this.setWaitingWorker(waitingWorker);
    } else if (this.state === "waiting") {
      this.waitingWorker = null;
      this.setState("hidden");
    }
  }

  private setWaitingWorker(worker: PwaUpdateWorker) {
    this.waitingWorker = worker;
    this.setState("waiting");
  }

  private setState(state: PwaUpdateState) {
    if (this.state === state) return;
    this.state = state;
    this.onStateChange(state);
  }
}
