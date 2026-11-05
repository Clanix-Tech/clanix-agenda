import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { getEnv } from '@/lib/env';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatPrivacyDate, PRIVACY_UPDATED_AT } from './privacyInfo';

const LINK_FOCUS =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-[#3B82F6]/50 focus-visible:ring-offset-2';
const TEXT_LINK = `rounded-sm font-semibold text-[#2563EB] underline underline-offset-2 ${LINK_FOCUS}`;
const CARD = 'flex flex-col gap-3 rounded-[18px] border border-[#E2E8F0] bg-white p-4';
const H2 = 'font-display text-lg leading-tight font-extrabold text-[#0F2D5B]';
const P = 'text-[15px] leading-relaxed text-[#475569]';
const UL = 'flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-[#475569]';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={CARD}>
      <h2 id={id} className={H2}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Política de Privacidade pública: acessível com ou sem login. */
export default function PrivacyPage() {
  const { session } = useAuth();
  const { privacyControllerName: name, privacyContactEmail: email } = getEnv();
  const mail = email ? (
    <a href={`mailto:${email}`} className={TEXT_LINK}>
      {email}
    </a>
  ) : null;
  return (
    <div className="min-h-dvh bg-[#F8FAFC] text-[#0F172A]">
      <header className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2">
          <Logo variant="full" size={36} />
          <Link
            to={session ? '/' : '/entrar'}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-[#2563EB] ${LINK_FOCUS}`}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-extrabold text-[#0F2D5B]">
            Política de Privacidade
          </h1>
          <p className={P}>
            Aqui explicamos, em linguagem simples, quais dados o Agenda em Ordem guarda e o que
            fazemos com eles. Atualizada em {formatPrivacyDate(PRIVACY_UPDATED_AT)}.
          </p>
        </div>

        <Section id="quem-somos" title="Quem somos">
          <p className={P}>
            O Agenda em Ordem é uma agenda para profissionais de beleza. Você, profissional, decide
            quais dados dos seus clientes colocar nela, por isso é quem responde por esses dados.
            Nós cuidamos deles em seu nome, só para o app funcionar.
          </p>
          <p className={P}>
            {name ? (
              <>
                Responsável pelo serviço: <b>{name}</b>.{' '}
              </>
            ) : null}
            {mail ? <>Fale com a gente pelo e-mail {mail}.</> : null}
            {!name && !mail ? 'Contato do responsável ainda não informado.' : null}
          </p>
        </Section>

        <Section id="dados" title="Quais dados guardamos">
          <ul className={UL}>
            <li>
              <b>Sua conta:</b> nome, e-mail e as preferências da sua agenda (como os horários de
              atendimento).
            </li>
            <li>
              <b>Seus clientes:</b> o que você digita: nome, telefone e observações (os dois últimos
              são opcionais), além dos atendimentos e do histórico.
            </li>
            <li>
              <b>Aparelhos com lembretes:</b> um endereço técnico para enviar as notificações e o
              nome do aparelho, se houver.
            </li>
          </ul>
          <p className={P}>
            Não usamos ferramentas de análise de uso nem de publicidade, e não vendemos dados.
          </p>
        </Section>

        <Section id="finalidade" title="Para que usamos">
          <p className={P}>
            Só para oferecer o serviço que você contratou ao criar a conta: mostrar sua agenda,
            evitar horários repetidos, guardar o histórico, enviar lembretes e e-mails da conta
            (como confirmação e recuperação de senha). Não usamos os dados para outra finalidade.
          </p>
        </Section>

        <Section id="compartilhamento" title="Com quem compartilhamos">
          <p className={P}>Usamos empresas que prestam serviços técnicos ao app:</p>
          <ul className={UL}>
            <li>
              <b>Supabase:</b> banco de dados e login, nos servidores do Supabase.
            </li>
            <li>
              <b>Cloudflare:</b> hospedagem do site e verificação anti-robô (quando ativada).
            </li>
            <li>
              <b>Provedor de e-mail:</b> recebe só o necessário para entregar os e-mails da conta.
            </li>
            <li>
              <b>Serviços de notificação da Apple, Google e Mozilla:</b> entregam os lembretes no
              seu aparelho. Eles recebem a mensagem <b>criptografada</b>, que só o seu aparelho
              consegue abrir. Em Ajustes, você pode ocultar o nome do cliente na tela de bloqueio.
            </li>
          </ul>
          <p className={P}>Fora isso, não compartilhamos seus dados, salvo se a lei exigir.</p>
        </Section>

        <Section id="retencao" title="Por quanto tempo guardamos">
          <ul className={UL}>
            <li>Guardamos os dados enquanto sua conta existir.</li>
            <li>
              Você pode excluir a conta quando quiser, em Ajustes. A exclusão é imediata e
              definitiva: apaga a conta, os clientes, os atendimentos, o histórico e os aparelhos
              com lembretes.
            </li>
            <li>
              Nossas cópias de segurança são apagadas em até 30 dias, então os dados excluídos
              também somem delas nesse prazo.
            </li>
            <li>Os registros técnicos de funcionamento do app não contêm dados pessoais.</li>
          </ul>
        </Section>

        <Section id="direitos" title="Seus direitos">
          <ul className={UL}>
            <li>
              <b>Acessar e levar seus dados:</b> em Ajustes › Conta e privacidade, use “Baixar meus
              dados (CSV)”.
            </li>
            <li>
              <b>Corrigir:</b> edite os dados direto no app.
            </li>
            <li>
              <b>Excluir:</b> em Ajustes › Conta e privacidade, use “Excluir minha conta”.
            </li>
            <li>
              <b>Tirar dúvidas ou fazer um pedido:</b>{' '}
              {mail ?? 'contato do responsável ainda não informado'}.
            </li>
          </ul>
          <p className={P}>
            Se você é cliente de um profissional e quer saber ou apagar seus dados, fale com o
            profissional: ele é quem responde por eles.
          </p>
        </Section>

        <Section id="seguranca" title="Segurança">
          <p className={P}>
            A conexão com o app é protegida (HTTPS), cada pessoa só enxerga os próprios dados e as
            senhas não ficam guardadas de forma legível. Nenhum sistema é 100% seguro; se acontecer
            um incidente que afete você, avisaremos.
          </p>
        </Section>

        <Section id="mudancas" title="Mudanças nesta política">
          <p className={P}>
            Se mudarmos algo importante, atualizamos esta página e a data no topo (hoje:{' '}
            {formatPrivacyDate(PRIVACY_UPDATED_AT)}).
          </p>
        </Section>
      </main>
    </div>
  );
}
