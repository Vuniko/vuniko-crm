(() => {
  const current = document.currentScript;
  if (!current) return;
  const key = current.getAttribute('data-widget-key');
  if (!key || document.getElementById('vuniko-chat-launcher')) return;

  const origin = new URL(current.src).origin;
  const wrap = document.createElement('div');
  wrap.id = 'vuniko-chat-launcher';
  wrap.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:system-ui,sans-serif';

  const frame = document.createElement('iframe');
  frame.title = 'Customer chat';
  frame.src = origin + '/chat/' + encodeURIComponent(key) + '?embed=1';
  frame.allow = 'clipboard-write';
  frame.style.cssText = 'display:none;width:min(390px,calc(100vw - 24px));height:min(620px,calc(100vh - 90px));border:0;border-radius:22px;box-shadow:0 18px 60px rgba(0,0,0,.22);background:white;margin-bottom:12px';

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label','Open chat');
  button.textContent = '✦';
  button.style.cssText = 'margin-left:auto;display:block;width:58px;height:58px;border:0;border-radius:999px;background:#111;color:#fff;font-size:24px;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.22)';

  let open = false;
  button.onclick = () => {
    open = !open;
    frame.style.display = open ? 'block' : 'none';
    button.textContent = open ? '×' : '✦';
    button.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
  };

  window.addEventListener('message', (event) => {
    if (event.origin !== origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'vuniko:theme' && /^#[0-9a-f]{6}$/i.test(event.data.color)) {
      button.style.background = event.data.color;
    }
  });

  wrap.append(frame,button);
  document.body.appendChild(wrap);
})();
