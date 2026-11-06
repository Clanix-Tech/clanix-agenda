import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { ArrowLeft, Download, Share, SquarePlus } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { getEnv } from '@/lib/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { devicePlatform } from '@/features/notifications/push';
import { useInstallPrompt } from './useInstallPrompt';

const TABS = [
  { value: 'iphone', label: 'iPhone' },
  { value: 'android', label: 'Android' },
  { value: 'computador', label: 'Computador' },
] as const;

const STEP = 'flex items-start gap-3 text-[15px] leading-snug text-foreground';
const BADGE =
  'font-display grid size-7 shrink-0 place-items-center rounded-[9px] bg-primary text-sm font-extrabold text-primary-foreground';
const INLINE = 'ml-1 inline size-4 align-[-3px] text-link';
const CARD = 'flex flex-col gap-4 rounded-[18px] border border-border bg-card p-4';
const CARD_TITLE = 'font-display text-base leading-tight font-extrabold text-foreground';
const LINK_FOCUS =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Guia público de instalação: abre na seção do aparelho em uso. Funciona com ou sem login. */
export default function InstallPage() {
  const { session } = useAuth();
  const [tab, setTab] = useState<string>(devicePlatform);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2">
          <Logo variant="horizontal" size={36} />
          <Link
            to={session ? '/' : '/entrar'}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-link ${LINK_FOCUS}`}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-extrabold text-foreground">Instalar o app</h1>
          <p className="text-[15px] text-foreground-secondary">
            Com o app instalado, a agenda abre pelo ícone e os lembretes chegam no seu aparelho.
          </p>
        </div>
        <TabsPrimitive.Root value={tab} onValueChange={setTab} className="flex flex-col gap-4">
          <TabsPrimitive.List
            aria-label="Aparelho"
            className="grid grid-cols-3 gap-1 rounded-[14px] bg-muted p-1"
          >
            {TABS.map(({ value, label }) => (
              <TabsPrimitive.Trigger
                key={value}
                value={value}
                className="min-h-11 rounded-[10px] px-2 text-sm font-semibold text-foreground-secondary outline-none focus-visible:ring-[3px] focus-visible:ring-ring data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {label}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>
          <TabsPrimitive.Content value="iphone" className="outline-none">
            <IPhoneGuide />
          </TabsPrimitive.Content>
          <TabsPrimitive.Content value="android" className="outline-none">
            <AndroidGuide />
          </TabsPrimitive.Content>
          <TabsPrimitive.Content value="computador" className="outline-none">
            <ComputerGuide />
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>
        <p className="text-center text-sm">
          <Link
            to="/privacidade"
            className={`inline-flex min-h-11 items-center rounded-xl px-2 font-semibold text-link underline underline-offset-2 ${LINK_FOCUS}`}
          >
            Política de Privacidade
          </Link>
        </p>
      </main>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className={STEP}>
      <span className={BADGE} aria-hidden="true">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function IPhoneGuide() {
  return (
    <section
      aria-labelledby="guia-iphone"
      className="flex flex-col gap-4 rounded-[18px] border border-secondary-border bg-secondary p-4"
    >
      <h2 id="guia-iphone" className={CARD_TITLE}>
        No iPhone, instale o app para receber lembretes
      </h2>
      <ol className="flex flex-col gap-3.5">
        <Step n={1}>
          No Safari, toque em <b>Compartilhar</b>
          <Share className={INLINE} aria-hidden="true" /> na barra inferior.
        </Step>
        <Step n={2}>
          Escolha <b>Adicionar à Tela de Início</b>
          <SquarePlus className={INLINE} aria-hidden="true" />.
        </Step>
        <Step n={3}>
          Abra o <b>Clanix Agenda</b> pelo ícone e volte aqui para ativar.
        </Step>
      </ol>
      <p className="text-sm leading-snug text-foreground-secondary">
        Depois de instalar, é preciso entrar de novo na sua conta: o app instalado não usa o login
        do Safari.
      </p>
    </section>
  );
}

function AndroidGuide() {
  const { canPrompt, prompt } = useInstallPrompt();
  const apkUrl = getEnv().apkDownloadUrl;
  // Se o navegador recusar o pedido, o botão some (o evento já foi usado) e ficam os passos manuais.
  const install = async () => {
    try {
      await prompt();
    } catch {
      // sem ação: o guia manual aparece
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="guia-android" className={CARD}>
        <h2 id="guia-android" className={CARD_TITLE}>
          No Android, instale pelo Chrome
        </h2>
        {canPrompt ? (
          <Button
            type="button"
            onClick={() => void install()}
            className="h-12 self-start rounded-[14px] px-6 text-[15px] font-bold"
          >
            <Download aria-hidden="true" />
            Instalar app
          </Button>
        ) : (
          <ol className="flex flex-col gap-3.5">
            <Step n={1}>
              Abra o Clanix Agenda no <b>Chrome</b> e toque no menu <b>⋮</b> (canto superior
              direito).
            </Step>
            <Step n={2}>
              Escolha <b>Instalar app</b>.
            </Step>
            <Step n={3}>Abra o app pelo ícone na tela inicial e entre na sua conta.</Step>
          </ol>
        )}
      </section>
      {apkUrl && (
        <section aria-labelledby="guia-apk" className={CARD}>
          <h2 id="guia-apk" className={CARD_TITLE}>
            Outra opção: arquivo do app
          </h2>
          <a
            href={apkUrl}
            className={`inline-flex min-h-12 items-center gap-2 self-start rounded-[14px] border border-border px-5 text-[15px] font-bold text-foreground ${LINK_FOCUS}`}
          >
            <Download aria-hidden="true" className="size-5" />
            Baixar o APK
          </a>
          <ol className="flex flex-col gap-3.5">
            <Step n={1}>Abra o arquivo baixado.</Step>
            <Step n={2}>
              Se o Android avisar que o app vem de fora da loja, toque em <b>Configurações</b> e
              ative <b>Permitir desta fonte</b> (instalar apps desconhecidos) para o navegador.
            </Step>
            <Step n={3}>Volte ao arquivo, toque em Instalar e abra o app.</Step>
          </ol>
        </section>
      )}
    </div>
  );
}

function ComputerGuide() {
  return (
    <section aria-labelledby="guia-computador" className={CARD}>
      <h2 id="guia-computador" className={CARD_TITLE}>
        No computador
      </h2>
      <ol className="flex flex-col gap-3.5">
        <Step n={1}>
          <b>Chrome ou Edge:</b> clique no ícone de instalar na barra de endereço (à direita) e
          confirme em <b>Instalar</b>.
        </Step>
        <Step n={2}>
          <b>Safari 17 ou mais novo, no Mac:</b> no menu <b>Arquivo</b>, escolha{' '}
          <b>Adicionar ao Dock</b>.
        </Step>
        <Step n={3}>Abra o app pelo ícone e entre na sua conta.</Step>
      </ol>
    </section>
  );
}
