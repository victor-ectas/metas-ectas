import { Module } from '@nestjs/common';

import { AuditoriaModule } from '../auditoria/auditoria.service.js';
import {
  CiclosController,
  FeriadosController,
  SetoresController,
  UsuariosController,
} from './cadastros.controllers.js';
import { CiclosService } from './ciclos.service.js';
import { FeriadosService } from './feriados.service.js';
import { SetoresService } from './setores.service.js';
import { UsuariosService } from './usuarios.service.js';

/** Cadastros básicos (P11): usuários, setores, ciclos, responsáveis e feriados. */
@Module({
  imports: [AuditoriaModule],
  controllers: [UsuariosController, SetoresController, CiclosController, FeriadosController],
  providers: [UsuariosService, SetoresService, CiclosService, FeriadosService],
})
export class CadastrosModule {}
