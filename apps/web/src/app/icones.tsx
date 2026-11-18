import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CategoryIcon from '@mui/icons-material/Category';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import FlagIcon from '@mui/icons-material/Flag';
import FunctionsIcon from '@mui/icons-material/Functions';
import HomeIcon from '@mui/icons-material/Home';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { ReactElement } from 'react';

/** Ícone de cada item do menu, pelo caminho; usado no menu e nos atalhos do Início. */
export const ICONES: Readonly<Record<string, ReactElement>> = {
  '/': <HomeIcon />,
  '/minhas-metas': <FlagIcon />,
  '/lancamentos': <EditCalendarIcon />,
  '/importacao': <UploadFileIcon />,
  '/visao-geral': <DashboardIcon />,
  '/metas': <TrackChangesIcon />,
  '/variaveis': <FunctionsIcon />,
  '/modelos': <CategoryIcon />,
  '/ciclos': <AccountTreeIcon />,
  '/fechamento': <EventAvailableIcon />,
  '/cadastros': <PeopleIcon />,
  '/configuracoes': <SettingsIcon />,
};
