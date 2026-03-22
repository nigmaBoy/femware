// Shared syntax theme definitions — import this in both editorTab and visualsTab

export interface SyntaxTheme {
  label: string;
  kw:  string; // keywords
  str: string; // strings
  cmt: string; // comments
  num: string; // numbers
  fn:  string; // function names
}

export const SYNTAX_THEMES: SyntaxTheme[] = [
  { label: 'Soft Blue',   kw: '#7eb8f7', str: '#f4a97f', cmt: '#81c784', num: '#c49ef5', fn: '#7ee8f7' },
  { label: 'Classic',     kw: '#569cd6', str: '#ce9178', cmt: '#6a9955', num: '#b5cea8', fn: '#dcdcaa' },
  { label: 'Dracula',     kw: '#ff79c6', str: '#f1fa8c', cmt: '#6272a4', num: '#bd93f9', fn: '#50fa7b' },
  { label: 'Monokai',     kw: '#f92672', str: '#e6db74', cmt: '#75715e', num: '#ae81ff', fn: '#a6e22e' },
  { label: 'One Dark',    kw: '#c678dd', str: '#98c379', cmt: '#5c6370', num: '#d19a66', fn: '#61afef' },
  { label: 'Tokyo Night', kw: '#bb9af7', str: '#9ece6a', cmt: '#565f89', num: '#ff9e64', fn: '#7dcfff' },
  { label: 'Rosé Pine',   kw: '#c4a7e7', str: '#f6c177', cmt: '#6e6a86', num: '#ebbcba', fn: '#9ccfd8' },
  { label: 'Nord',        kw: '#81a1c1', str: '#a3be8c', cmt: '#616e88', num: '#b48ead', fn: '#88c0d0' },
  { label: 'Gruvbox',     kw: '#fb4934', str: '#b8bb26', cmt: '#928374', num: '#d3869b', fn: '#fabd2f' },
  { label: 'Solarized',   kw: '#268bd2', str: '#2aa198', cmt: '#657b83', num: '#d33682', fn: '#859900' },
];

export const DEFAULT_SYNTAX_THEME = 'Soft Blue';