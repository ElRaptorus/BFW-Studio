import { createRoot } from 'react-dom/client';

import Sidebar from './Sidebar';

const container = document.getElementById('root')!;
createRoot(container).render(<Sidebar />);
