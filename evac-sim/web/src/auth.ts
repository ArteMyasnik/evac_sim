import { api } from './api';
import type { User } from './types';

export const Auth = {
    currentUser: null as User | null,

    async login(username: string, password: string) {
        this.currentUser = await api.auth.login(username, password);
        return this.currentUser;
    },

    async logout() {
        await api.auth.logout();
        this.currentUser = null;
        location.href = '/login.html';
    },

    async check() {
        try {
            this.currentUser = await api.auth.me();
            return true;
        } catch {
            this.currentUser = null;
            return false;
        }
    },

    async requireAuth() {
        const ok = await this.check();
        if (!ok) {
            location.href = '/login.html';
        }
    },

    renderHeader(title: string) {
        const h = document.createElement('header');
        h.innerHTML = `
      <b>${title}</b>
      <a href="/buildings.html">Мои здания</a>
      <a href="#" id="logout">Выйти</a>
    `;
        document.body.prepend(h);
        document.getElementById('logout')!.onclick = (e) => {
            e.preventDefault();
            this.logout();
        };
    }
};