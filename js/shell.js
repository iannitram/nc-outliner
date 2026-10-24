let nextShellId = 0;

/** Mount the page regions shared by the file browser and outline editor. */
export function mountShell(root) {
  const document = root.ownerDocument;
  const id = `outliner-content-${++nextShellId}`;
  const shell = document.createElement('div');
  shell.className = 'outliner-shell';
  const skip = document.createElement('a');
  skip.className = 'outliner-skip-link';
  skip.href = `#${id}`;
  skip.textContent = 'Skip to outline';
  const navigation = document.createElement('nav');
  navigation.className = 'outliner-navigation';
  navigation.setAttribute('aria-label', 'Outline files');
  const workspace = document.createElement('section');
  workspace.className = 'outliner-workspace';
  workspace.setAttribute('aria-label', 'Outline workspace');
  const toolbar = document.createElement('header');
  toolbar.className = 'outliner-toolbar';
  const content = document.createElement('div');
  content.id = id;
  content.className = 'outliner-content';
  content.tabIndex = -1;
  content.setAttribute('role', 'region');
  content.setAttribute('aria-label', 'Outline editor');
  const status = document.createElement('p');
  status.className = 'outliner-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  workspace.append(toolbar, content, status);
  shell.append(skip, navigation, workspace);
  root.replaceChildren(shell);
  const focusContent = () => content.focus();
  skip.addEventListener('click', focusContent);
  return {
    navigation, toolbar, content, status,
    destroy() {
      skip.removeEventListener('click', focusContent);
      shell.remove();
    },
  };
}
