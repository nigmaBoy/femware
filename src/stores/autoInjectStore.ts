let _autoInject = false;
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach(l => l());
}

export function getAutoInject(): boolean {
  return _autoInject;
}

export function setAutoInject(value: boolean): void {
  _autoInject = value;
  notify();
}

export function subscribeAutoInject(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}