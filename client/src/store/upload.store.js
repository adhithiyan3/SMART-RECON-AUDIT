import { create } from 'zustand';

export const useUploadStore = create((set) => ({
    activeJobId: localStorage.getItem('activeJobId') || null,
    setActiveJobId: (id) => {
        if (id) {
            localStorage.setItem('activeJobId', id);
        } else {
            localStorage.removeItem('activeJobId');
        }
        set({ activeJobId: id });
    }
}));
