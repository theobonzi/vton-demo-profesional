import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';

export default function Header() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();

  const initials = (user?.email || '?')[0]?.toUpperCase();

  return (
    <header className="w-full border-b bg-white/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-semibold">WearIt</Link>
        <nav className="flex items-center gap-3">
          <Link to="/">Produits</Link>
          {isAuthenticated ? (
            <>
              <span className="inline-flex items-center gap-2">
                <span className="relative inline-flex h-8 w-8 select-none items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-700">
                  {initials}
                  <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" />
                </span>
              </span>
              <Button variant="outline" onClick={() => { logout(); navigate('/'); }}>Se déconnecter</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate('/login')}>Se connecter</Button>
              <Button onClick={() => navigate('/register')}>S'inscrire</Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
