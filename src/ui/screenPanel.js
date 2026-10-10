// Screen-only dialogs require a real touch. Pause VR input while they are open.
export function screenPanel(app, title) {
  const dialog = document.createElement('dialog');
  dialog.className = 'screen-panel';
  const heading = document.createElement('h2'); heading.textContent = title;
  const content = document.createElement('div');
  const close = document.createElement('button'); close.textContent = 'Voltar ao BlueNav'; close.type = 'button';
  const hint = document.createElement('p'); hint.className = 'panel-hint';
  hint.textContent = 'Use o toque na tela para configurar antes de colocar o VR Box.';
  dialog.append(heading, hint, content, close); document.body.append(dialog);
  close.onclick = () => dialog.close();
  dialog.addEventListener('close', () => { if (app.screenDialog === dialog) app.screenDialog = null; });
  return { content, dialog, show() {
    if (dialog.open) return;
    app.screenDialog?.close(); app.screenDialog = dialog; dialog.showModal();
  }, dispose() { if (dialog.open) dialog.close(); dialog.remove(); } };
}
