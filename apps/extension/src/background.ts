/**
 * Service worker: owns the chrome.debugger session for the tab under test.
 * The side panel talks to it over a long-lived port; if the panel closes or the
 * port drops, the tab's network is always restored and the debugger detached.
 */

type Command =
  | { id: number | string; type: 'attach'; tabId: number }
  | { id: number | string; type: 'detach'; tabId: number }
  | { id: number | string; type: 'profile'; tabId: number; profile: 'online' | 'offline' | 'flaky' }
  | { id: number | string; type: 'capture'; tabId: number }
  // Kept for the runtime acceptance script.
  | { id: number | string; type: 'offline'; tabId: number; offline: boolean };

const ONLINE = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
const OFFLINE = { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
const FLAKY = { offline: false, latency: 3000, downloadThroughput: 6250, uploadThroughput: 2500 };
const FLAKY_DROP_AFTER_MS = 1000;

const attached = new Set<number>();
const dropTimers = new Map<number, ReturnType<typeof setTimeout>>();

void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

function emulate(tabId: number, conditions: typeof ONLINE) {
  return chrome.debugger.sendCommand({ tabId }, 'Network.emulateNetworkConditions', conditions);
}

function clearDrop(tabId: number) {
  clearTimeout(dropTimers.get(tabId));
  dropTimers.delete(tabId);
}

async function restore(tabId: number) {
  clearDrop(tabId);
  if (!attached.has(tabId)) return;
  try {
    await emulate(tabId, ONLINE);
  } catch {
    /* tab may already be gone */
  }
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    /* already detached */
  }
  attached.delete(tabId);
}

async function handle(command: Command): Promise<unknown> {
  const { tabId } = command;
  switch (command.type) {
    case 'attach':
      if (!attached.has(tabId)) {
        await chrome.debugger.attach({ tabId }, '1.3');
        attached.add(tabId);
      }
      await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
      return undefined;
    case 'profile':
      clearDrop(tabId);
      if (command.profile === 'online') await emulate(tabId, ONLINE);
      else if (command.profile === 'offline') await emulate(tabId, OFFLINE);
      else {
        // Flaky: very slow first, then the connection drops mid-request.
        await emulate(tabId, FLAKY);
        dropTimers.set(
          tabId,
          setTimeout(() => void emulate(tabId, OFFLINE).catch(() => undefined), FLAKY_DROP_AFTER_MS),
        );
      }
      return undefined;
    case 'offline':
      clearDrop(tabId);
      await emulate(tabId, command.offline ? OFFLINE : ONLINE);
      return undefined;
    case 'capture': {
      const shot = (await chrome.debugger.sendCommand({ tabId }, 'Page.captureScreenshot', {
        format: 'jpeg',
        quality: 65,
        captureBeyondViewport: false,
      })) as { data: string };
      return shot.data;
    }
    case 'detach':
      await restore(tabId);
      return undefined;
  }
}

chrome.runtime.onConnect.addListener((port) => {
  const tabs = new Set<number>();
  port.onMessage.addListener(async (command: Command) => {
    tabs.add(command.tabId);
    try {
      const data = await handle(command);
      port.postMessage({ id: command.id, ok: true, data });
    } catch (error) {
      port.postMessage({ id: command.id, error: String(error) });
    }
  });
  port.onDisconnect.addListener(() => {
    for (const tabId of tabs) void restore(tabId);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearDrop(tabId);
  attached.delete(tabId);
});

chrome.debugger.onDetach.addListener(({ tabId }) => {
  if (tabId !== undefined) {
    clearDrop(tabId);
    attached.delete(tabId);
  }
});
