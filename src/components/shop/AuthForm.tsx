import { useState } from 'react';
import { api } from './api';
import { contactUrl } from '../../content/site';
import type { User } from './types';
export default function AuthForm({
  onLogin,
  admin = false,
}: {
  onLogin: (user: User) => void;
  admin?: boolean;
}) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <section className="shop-auth">
      <p className="eyebrow">
        {admin ? 'Acceso exclusivo del atelier' : 'Tu espacio en Qalbi'}
      </p>
      {admin ? (
        <h1>Bienvenida a tu atelier.</h1>
      ) : (
        <h2>{register ? 'Vamos a conocernos.' : 'Qué bonito verte.'}</h2>
      )}
      <p>
        {admin
          ? 'Gestiona tus pedidos, productos y página inicial desde un solo lugar.'
          : 'Accede con tu email o teléfono y contraseña para seguir tus pedidos y hablar con el atelier.'}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const data = new FormData(e.currentTarget);
          try {
            const body = admin
              ? { email: data.get('contact'), password: data.get('password') }
              : register
                ? {
                    name: data.get('name'),
                    email: data.get('contact'),
                    phone: data.get('phone'),
                    password: data.get('password'),
                  }
                : {
                    identifier: data.get('contact'),
                    password: data.get('password'),
                  };
            const result = await api<{ user: User }>(
              admin
                ? '/auth/admin/login'
                : `/auth/${register ? 'register' : 'login'}`,
              'POST',
              body,
            );
            onLogin(result.user);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {register && (
          <label>
            Tu nombre
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          </label>
        )}
        <label>
          {admin
            ? 'Email del administrador'
            : register
              ? 'Email'
              : 'Email o teléfono'}
          <input
            key={register ? 'email' : 'identifier'}
            type={register || admin ? 'email' : 'text'}
            name="contact"
            required
            maxLength={254}
            autoComplete={register ? 'email' : 'username'}
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        {register && (
          <label>
            Teléfono (opcional)
            <input
              type="tel"
              name="phone"
              maxLength={40}
              autoComplete="tel"
              placeholder="+34 600 123 456"
              aria-describedby="phone-help"
            />
            <small id="phone-help">
              Incluye + y el prefijo de tu país. También podrás usar este número
              para entrar con tu contraseña.
            </small>
          </label>
        )}
        {!register && !admin && (
          <p className="shop-muted">
            Para entrar con teléfono, usa el número registrado con su prefijo de
            país.
          </p>
        )}
        <label>
          Contraseña
          <input
            type="password"
            name="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete={register ? 'new-password' : 'current-password'}
          />
          <small>Mínimo 12 caracteres.</small>
        </label>
        {error && (
          <p role="alert" className="shop-error">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy
            ? 'Un momento…'
            : admin
              ? 'Entrar al panel'
              : register
                ? 'Crear mi cuenta'
                : 'Entrar'}
        </button>
      </form>
      {!admin && (
        <>
          <button
            className="shop-text-button"
            onClick={() => {
              setRegister(!register);
              setError('');
            }}
          >
            {register ? 'Ya tengo una cuenta' : 'Crear una cuenta'}
          </button>
          <p className="shop-muted">
            ¿Necesitas recuperar el acceso?{' '}
            <a href={contactUrl()} target="_blank" rel="noreferrer">
              Contacta con el atelier
            </a>
            .
          </p>
        </>
      )}
    </section>
  );
}
