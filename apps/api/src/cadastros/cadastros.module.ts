import { Module } from '@nestjs/common';

import { AuditoriaModule } from '../auditoria/auditoria.service.js';
import { ResultadosModule } from '../resultados/resultados.module.js';
import {
  CiclosController,
  FeriadosController,
  SetoresController,
  UsuariosController,
} from './cadastros.controllers.js';
import { CiclosService } from './ciclos.service.js';
import { ConsistenciaService } from './consistencia.service.js';
import { FeriadosService } from './feriados.service.js';
import { SetoresService } from './setores.service.js';
import { UsuariosService } from './usuarios.service.js';

/**
 * Cadastros básicos (P11): usuários, setores, ciclos, responsáveis e feriados; consistência,
 * ativação e encerramento do ciclo (P15).
 */
@Module({
  imports: [AuditoriaModule, ResultadosModule],
  controllers: [UsuariosController, SetoresController, CiclosController, FeriadosController],
  providers: [UsuariosService, SetoresService, CiclosService, ConsistenciaService, FeriadosService],
})
export class CadastrosModule {}
