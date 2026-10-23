import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './RoleGate';
import {I18nProvider} from './i18n';
import './styles.css';
import './semester.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nProvider><App /></I18nProvider></React.StrictMode>);

import './weeklyCourses.css';
import 'katex/dist/katex.min.css';
import './materialStudy.css';
import './workbench.css';

import './simplified.css';

import './homeTimeline.css';
import './campus.css';
