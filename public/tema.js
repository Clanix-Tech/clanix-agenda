// Aplica o tema antes da primeira pintura (script clássico e síncrono, por causa da CSP).
// Par de src/lib/theme.ts (readThemePreference + resolveTheme + applyTheme): mantenha a mesma regra nos dois.
(function () {
  var pref = 'auto';
  try {
    var saved = localStorage.getItem('clanix-tema');
    if (saved === 'claro' || saved === 'escuro') pref = saved;
  } catch (e) {}
  var systemDark = false;
  try {
    systemDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch (e) {}
  var dark = pref === 'escuro' || (pref === 'auto' && systemDark);
  var root = document.documentElement;
  if (dark) root.classList.add('dark');
  else root.classList.remove('dark');
  root.style.colorScheme = dark ? 'dark' : 'light';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0B0420' : '#F8F7FF');
})();
