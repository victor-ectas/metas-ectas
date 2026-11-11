import { describe, expect, it } from 'vitest';

import { carregarConfig, ErroConfiguracao } from '../src/config/config.js';

const MINIMO = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://metas_app:x@localhost:5433/metas',
  WEB_ORIGIN: 'http://localhost:5173',
  ENTRA_TENANT_ID: '11111111-2222-4333-8444-555555555555',
  ENTRA_API_AUDIENCE: 'api://metas',
};

function problemas(env: Record<string, string | undefined>): string[] {
  try {
    carregarConfig(env);
  } catch (erro) {
    if (erro instanceof ErroConfiguracao) return erro.problemas;
    throw erro;
  }
  throw new Error('Era esperado erro de configuração');
}

describe('carregarConfig', () => {
  it('aplica os valores padrão', () => {
    expect(carregarConfig(MINIMO)).toEqual({
      ...MINIMO,
      ENTRA_API_AUDIENCE: ['api://metas'],
      AUTH_DEV: false,
      PORT_API: 3000,
      LOG_LEVEL: 'info',
      LIMITE_ESCRITA_POR_MINUTO: 120,
    });
  });

  it('converte números vindos do ambiente', () => {
    const config = carregarConfig({ ...MINIMO, PORT_API: '8080', LIMITE_ESCRITA_POR_MINUTO: '10' });
    expect(config.PORT_API).toBe(8080);
    expect(config.LIMITE_ESCRITA_POR_MINUTO).toBe(10);
  });

  it('lista todas as variáveis obrigatórias que faltam', () => {
    expect(problemas({})).toEqual([
      'NODE_ENV: obrigatória: development, test ou production',
      'DATABASE_URL: obrigatória',
      'WEB_ORIGIN: obrigatória',
    ]);
  });

  it('variável vazia no .env conta como ausente', () => {
    expect(problemas({ ...MINIMO, DATABASE_URL: '' })).toEqual(['DATABASE_URL: obrigatória']);
  });

  it('recusa valores inválidos com mensagem em português', () => {
    expect(
      problemas({
        NODE_ENV: 'prod',
        PORT_API: '70000',
        DATABASE_URL: 'mysql://x',
        WEB_ORIGIN: 'localhost',
        LOG_LEVEL: 'verbose',
        LIMITE_ESCRITA_POR_MINUTO: '0',
      }),
    ).toEqual([
      'NODE_ENV: obrigatória: development, test ou production',
      'PORT_API: deve estar entre 1 e 65535',
      'DATABASE_URL: deve ser uma URL postgresql://',
      'WEB_ORIGIN: deve ser uma URL, ex.: https://metas.empresa.com.br',
      'LOG_LEVEL: deve ser fatal, error, warn, info, debug, trace ou silent',
      'LIMITE_ESCRITA_POR_MINUTO: deve ser maior que zero',
    ]);
  });

  it('a mensagem do erro lista os problemas para o log de inicialização', () => {
    expect(() => carregarConfig({})).toThrow(
      'Configuração inválida. Corrija as variáveis de ambiente:\n- NODE_ENV:',
    );
  });

  it('aceita várias audiências separadas por vírgula', () => {
    const config = carregarConfig({
      ...MINIMO,
      ENTRA_API_AUDIENCE: 'api://metas, 99999999-8888-4777-8666-555555555555',
    });
    expect(config.ENTRA_API_AUDIENCE).toEqual([
      'api://metas',
      '99999999-8888-4777-8666-555555555555',
    ]);
  });

  it('exige o tenant e a audiência do Entra ID fora do modo DEV', () => {
    expect(problemas({ ...MINIMO, ENTRA_TENANT_ID: '', ENTRA_API_AUDIENCE: undefined })).toEqual([
      'ENTRA_TENANT_ID: obrigatória',
      'ENTRA_API_AUDIENCE: obrigatória',
    ]);
    expect(problemas({ ...MINIMO, ENTRA_TENANT_ID: 'contoso' })).toEqual([
      'ENTRA_TENANT_ID: deve ser o GUID do tenant (ID do diretório)',
    ]);
  });

  describe('modo DEV de autenticação (CLAUDE.md 6)', () => {
    const DEV = {
      NODE_ENV: 'development',
      DATABASE_URL: MINIMO.DATABASE_URL,
      WEB_ORIGIN: MINIMO.WEB_ORIGIN,
      AUTH_DEV: 'true',
      AUTH_DEV_EMAIL: 'Admin@Empresa.com.br',
    };

    it('em desenvolvimento, dispensa o Entra ID e normaliza o e-mail', () => {
      const config = carregarConfig(DEV);
      expect(config.AUTH_DEV).toBe(true);
      expect(config.AUTH_DEV_EMAIL).toBe('admin@empresa.com.br');
      expect(config.ENTRA_TENANT_ID).toBeUndefined();
    });

    it('a API não inicia com AUTH_DEV=true em produção', () => {
      expect(problemas({ ...DEV, NODE_ENV: 'production' })).toEqual([
        'AUTH_DEV: AUTH_DEV=true só é permitido com NODE_ENV=development (atual: production). A API não inicia assim.',
      ]);
    });

    it('nem em teste', () => {
      expect(problemas({ ...DEV, NODE_ENV: 'test' })).toHaveLength(1);
    });

    it('exige o usuário simulado', () => {
      expect(problemas({ ...DEV, AUTH_DEV_EMAIL: '' })).toEqual([
        'AUTH_DEV_EMAIL: obrigatória com AUTH_DEV=true',
      ]);
    });

    it('recusa valor que não seja true ou false', () => {
      expect(problemas({ ...MINIMO, AUTH_DEV: 'sim' })).toEqual([
        'AUTH_DEV: deve ser true ou false',
      ]);
    });

    it('AUTH_DEV=false em produção é aceito', () => {
      expect(
        carregarConfig({ ...MINIMO, NODE_ENV: 'production', AUTH_DEV: 'false' }).AUTH_DEV,
      ).toBe(false);
    });
  });
});
