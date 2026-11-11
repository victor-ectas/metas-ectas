import type { Perfil } from '@metas/tipos';
import { describe, expect, it } from 'vitest';

import type { UsuarioAtual } from '../src/auth/usuario-atual.js';
import {
  type MetaParaAcesso,
  PoliticasService,
  responsavelPeloLancamento,
} from '../src/politicas/politicas.service.js';

const politicas = new PoliticasService();

const SETOR_RH = 'setor-rh';
const SETOR_TI = 'setor-ti';

function usuario(perfil: Perfil, alteracoes: Partial<UsuarioAtual> = {}): UsuarioAtual {
  return {
    id: `id-${perfil.toLowerCase()}`,
    nome: perfil,
    email: `${perfil.toLowerCase()}@empresa.com.br`,
    perfil,
    ativo: true,
    gerenteGeral: false,
    setoresLeitor: [],
    ...alteracoes,
  };
}

const admin = usuario('ADMIN');
const diretoria = usuario('DIRETORIA');
const gestor = usuario('GESTOR');
const leitor = usuario('LEITOR', { setoresLeitor: [SETOR_RH] });
const TODOS = [admin, diretoria, gestor, leitor];
const inativos = TODOS.map((u) => ({ ...u, ativo: false }));

/** Meta do setor TI de outro gestor, sem atribuição ao gestor de teste. */
const metaAlheia: MetaParaAcesso = {
  setorId: SETOR_TI,
  responsavelId: 'outro-gestor',
  atribuidos: ['outro-gestor'],
};

describe('PoliticasService (CLAUDE.md 7.5)', () => {
  describe('cadastros e metas: só o Administrador', () => {
    it.each([
      ['ADMIN', true],
      ['DIRETORIA', false],
      ['GESTOR', false],
      ['LEITOR', false],
    ] as const)('%s → %s', (perfil, esperado) => {
      const u = usuario(perfil);
      expect(politicas.podeEditarCadastros(u)).toBe(esperado);
      expect(politicas.podeEditarMetas(u)).toBe(esperado);
      expect(politicas.podeFazerCargaHistorica(u)).toBe(esperado);
    });
  });

  describe('usuário inativo não pode nada', () => {
    it.each(inativos)('$perfil inativo', (u) => {
      expect(politicas.temPerfil(u, [u.perfil])).toBe(false);
      expect(politicas.podeEditarCadastros(u)).toBe(false);
      expect(politicas.podeEditarMetas(u)).toBe(false);
      expect(politicas.veTudo(u)).toBe(false);
      expect(politicas.podeVerMeta(u, { ...metaAlheia, setorId: SETOR_RH })).toBe(false);
      expect(politicas.podeVerMeta(u, { ...metaAlheia, responsavelId: u.id })).toBe(false);
      expect(politicas.podeVerHistorico(u, { ...metaAlheia, responsavelId: u.id })).toBe(false);
      expect(politicas.podeLancar(u, { responsavelId: u.id })).toBe(false);
      expect(politicas.podeFazerCargaHistorica(u)).toBe(false);
    });
  });

  describe('temPerfil', () => {
    it('confere o perfil na lista', () => {
      expect(politicas.temPerfil(gestor, ['ADMIN', 'GESTOR'])).toBe(true);
      expect(politicas.temPerfil(gestor, ['ADMIN'])).toBe(false);
      expect(politicas.temPerfil(gestor, [])).toBe(false);
    });
  });

  describe('ver metas e resultados', () => {
    it('Administrador e Diretoria veem todas', () => {
      expect(politicas.podeVerMeta(admin, metaAlheia)).toBe(true);
      expect(politicas.podeVerMeta(diretoria, metaAlheia)).toBe(true);
      expect(politicas.veTudo(admin)).toBe(true);
      expect(politicas.veTudo(diretoria)).toBe(true);
      expect(politicas.veTudo(gestor)).toBe(false);
      expect(politicas.veTudo(leitor)).toBe(false);
    });

    it('Gestor vê as metas pelas quais é responsável', () => {
      expect(politicas.podeVerMeta(gestor, { ...metaAlheia, responsavelId: gestor.id })).toBe(true);
    });

    it('Gestor vê as metas atribuídas a ele (meta corporativa, RN-05)', () => {
      const corporativa = { ...metaAlheia, atribuidos: ['outro-gestor', gestor.id] };
      expect(politicas.podeVerMeta(gestor, corporativa)).toBe(true);
    });

    it('Gestor não vê metas de outros gestores', () => {
      expect(politicas.podeVerMeta(gestor, metaAlheia)).toBe(false);
    });

    it('Gestor vê a submeta de uma meta que ele vê, mesmo sem ser responsável por ela', () => {
      const submeta: MetaParaAcesso = {
        setorId: SETOR_TI,
        responsavelId: 'outro-gestor',
        atribuidos: [],
        mae: { ...metaAlheia, atribuidos: [gestor.id] },
      };
      expect(politicas.podeVerMeta(gestor, submeta)).toBe(true);
      expect(politicas.podeVerMeta(gestor, { ...submeta, mae: metaAlheia })).toBe(false);
      expect(politicas.podeVerMeta(gestor, { ...submeta, mae: null })).toBe(false);
    });

    it('Gestor vê a submeta pela qual é responsável', () => {
      const submeta = { ...metaAlheia, atribuidos: [], responsavelId: gestor.id, mae: metaAlheia };
      expect(politicas.podeVerMeta(gestor, submeta)).toBe(true);
    });

    it('Leitor vê só as metas dos setores liberados a ele', () => {
      expect(politicas.podeVerMeta(leitor, { ...metaAlheia, setorId: SETOR_RH })).toBe(true);
      expect(politicas.podeVerMeta(leitor, metaAlheia)).toBe(false);
      expect(politicas.podeVerMeta(usuario('LEITOR'), { ...metaAlheia, setorId: SETOR_RH })).toBe(
        false,
      );
    });

    it('Leitor vê a submeta quando o setor da meta-mãe está liberado', () => {
      const submeta = { ...metaAlheia, mae: { ...metaAlheia, setorId: SETOR_RH } };
      expect(politicas.podeVerMeta(leitor, submeta)).toBe(true);
    });

    it('Leitor não vê meta de outro setor só por ser responsável ou atribuído', () => {
      const meta = { ...metaAlheia, responsavelId: leitor.id, atribuidos: [leitor.id] };
      expect(politicas.podeVerMeta(leitor, meta)).toBe(false);
    });
  });

  describe('ver histórico de alterações', () => {
    it('Administrador e Diretoria veem todos', () => {
      expect(politicas.podeVerHistorico(admin, metaAlheia)).toBe(true);
      expect(politicas.podeVerHistorico(diretoria, metaAlheia)).toBe(true);
    });

    it('Gestor vê só o das próprias metas', () => {
      expect(politicas.podeVerHistorico(gestor, { ...metaAlheia, responsavelId: gestor.id })).toBe(
        true,
      );
      expect(politicas.podeVerHistorico(gestor, { ...metaAlheia, atribuidos: [gestor.id] })).toBe(
        true,
      );
      expect(politicas.podeVerHistorico(gestor, metaAlheia)).toBe(false);
    });

    it('Leitor não vê histórico, nem dos setores liberados', () => {
      expect(politicas.podeVerHistorico(leitor, { ...metaAlheia, setorId: SETOR_RH })).toBe(false);
    });
  });

  describe('lançar variáveis (pronto para o P18)', () => {
    it('só o Gestor responsável pelo lançamento', () => {
      expect(politicas.podeLancar(gestor, { responsavelId: gestor.id })).toBe(true);
      expect(politicas.podeLancar(gestor, { responsavelId: 'outro-gestor' })).toBe(false);
      expect(politicas.podeLancar(gestor, { responsavelId: null })).toBe(false);
    });

    it.each([admin, diretoria, leitor])(
      '$perfil não lança, mesmo se constar como responsável',
      (u) => {
        expect(politicas.podeLancar(u, { responsavelId: u.id })).toBe(false);
      },
    );

    it('responsável: no Corporativo, o da variável; nos outros setores, o do setor no ciclo (RN-07)', () => {
      const dados = {
        responsavelDaVariavel: 'gestor-var',
        responsavelDoSetorNoCiclo: 'gestor-setor',
      };
      expect(responsavelPeloLancamento({ ...dados, setorCorporativo: true })).toBe('gestor-var');
      expect(responsavelPeloLancamento({ ...dados, setorCorporativo: false })).toBe('gestor-setor');
      expect(
        responsavelPeloLancamento({
          setorCorporativo: false,
          responsavelDaVariavel: null,
          responsavelDoSetorNoCiclo: null,
        }),
      ).toBeNull();
    });
  });
});
