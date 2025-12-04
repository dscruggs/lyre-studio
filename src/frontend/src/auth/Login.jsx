import React from 'react';
import { useAuth } from './AuthContext';
import { LogIn } from 'lucide-react';

export default function Login() {
    const { login } = useAuth();

    return (
        <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
            <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 max-w-md w-full text-center space-y-6 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                    <img src="./lyre_logo.png" alt="Lyre" className="w-16 h-16" />
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        Lyre Studio
                    </h1>
                    <p className="text-slate-400">Sign in to access Lyre Studio</p>
                </div>

                <button
                    onClick={login}
                    className="w-full py-3 px-4 bg-white text-slate-900 font-medium rounded-xl flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors"
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                    Sign in with Google
                </button>

                <div className="text-xs text-slate-500">
                    Access is restricted to authorized users only.
                </div>
            </div>
        </div>
    );
}

