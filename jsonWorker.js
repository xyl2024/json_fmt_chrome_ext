self.onmessage = (event) => {
  const data = event.data || {};
  const id = data.id;
  const type = data.type;
  const text = data.text;

  if (type === 'format') {
    try {
      const parsed = JSON.parse(text);
      const formatted = JSON.stringify(parsed, null, 2);
      self.postMessage({ id, ok: true, formatted });
    } catch {
      self.postMessage({ id, ok: false, error: 'JSON 格式错误' });
    }
    return;
  }

  if (type === 'validate') {
    try {
      JSON.parse(text);
      self.postMessage({ id, ok: true });
    } catch {
      self.postMessage({ id, ok: false, error: 'JSON 格式错误' });
    }
  }
};
