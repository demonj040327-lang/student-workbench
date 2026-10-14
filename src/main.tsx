import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './semester.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

import './monthTimeline.css';
import './weeklyCourses.css';
import 'katex/dist/katex.min.css';
import './materialStudy.css';
