---
"@fluxo/react": major
---

Interface pública em inglês (F41, ADR 0031). Os textos da tela continuam em português; a API (caminhos, campos e códigos) não muda nesta versão.

- Componentes: `<Inicio>` → `<Home>`, `<Administracao>` → `<Admin>`, `<Auditoria>` → `<Audit>`, `<Entrar>` → `<SignIn>`, `<RedefinirSenha>` → `<ResetPassword>`.
- Tipos: `InicioProps` → `HomeProps`, `AdministracaoProps` → `AdminProps`, `AuditoriaProps` → `AuditProps`, `TelaAvulsaProps` → `StandaloneScreenProps`, `EntrarProps` → `SignInProps`, `RedefinirSenhaProps` → `ResetPasswordProps`, `Sessao` → `Session`, `TelaFluxo` → `FluxoScreen`, `TemaFluxo` → `FluxoTheme`, `NavegacaoFluxo` → `FluxoNavigation`, `EventoFluxo` → `FluxoEvent` (`FluxoCalculo` e `FluxoCalculoProps` ficam).
- Props: `tela` → `screen`, `tema` → `theme`, `navegacao` → `navigation`, `onEvento` → `onEvent`, `onSessaoExpirada` → `onSessionExpired`; em `<SignIn>`, `onEntrar` → `onSignIn`; em `<ResetPassword>`, `onSalvar` → `onSave`.
- Valores: `theme` aceita `'light' | 'dark' | 'system'` (era `'claro' | 'escuro' | 'sistema'`); `navigation` aceita `'url' | 'memory'` (era `'memoria'`); `screen` aceita `'home'`, `'audit'`, `'admin'`, `'users'`, `'roles'`, `'integration'` e `'security'` (eram `'inicio'`, `'auditoria'`, `'administracao'`, `'usuarios'`, `'papeis'`, `'integracao'` e `'seguranca'`).
- Eventos (`onEvent`): nenhum é emitido ainda; os próximos nascem em inglês.
- CSS publicado: `@fluxo/react/estilos.css` → `@fluxo/react/styles.css`. A raiz do módulo, onde o hospedeiro sobrescreve os tokens, passa de `.fc-raiz` para `.fc-root`; todas as classes `fc-` estão em inglês (os tokens `--fc-*` não mudam).
- Rotas internas no modo `url`: `/inicio` → `/home`, `/auditoria` → `/audit`, `/administracao/...` → `/admin/...` (`users`, `roles`, `integration`, `security`).
