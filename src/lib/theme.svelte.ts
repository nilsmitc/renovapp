/**
 * Globaler Theme-Store (hell/dunkel).
 * Die initiale Klasse auf <html> setzt bereits das Inline-Snippet in app.html
 * (vor dem ersten Paint, verhindert FOUC) — init() liest diesen Zustand nur aus.
 */
class ThemeStore {
	current = $state<'light' | 'dark'>('light');

	init() {
		if (typeof document === 'undefined') return;
		this.current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
	}

	toggle() {
		if (typeof document === 'undefined') return;
		this.current = this.current === 'dark' ? 'light' : 'dark';
		document.documentElement.classList.toggle('dark', this.current === 'dark');
		localStorage.setItem('theme', this.current);
	}
}

export const theme = new ThemeStore();
