import { Injectable } from '@nestjs/common';

/**
 * Instante atual, num provider: os testes trocam por um relógio fixo para simular mês aberto,
 * fechado, reaberto e futuro (RN-34) sem depender da data em que rodam.
 */
@Injectable()
export class Relogio {
  agora(): Date {
    return new Date();
  }
}
