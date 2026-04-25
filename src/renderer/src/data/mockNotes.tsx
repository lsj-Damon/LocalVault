import { Clock3, FileText, Star } from 'lucide-react';
import type { ReactNode } from 'react';

export const navItems: Array<{ label: string; icon: ReactNode; active?: boolean }> = [
  { label: 'All Notes', icon: <FileText size={20} />, active: true },
  { label: 'Favorites', icon: <Star size={20} /> },
  { label: 'Recent', icon: <Clock3 size={20} /> }
];

export const tags = [{ label: 'DevOps' }, { label: 'Design' }, { label: 'Sensitive' }];

export const notes = [
  {
    title: 'AWS Production Environment',
    date: 'Apr 24',
    summary: 'Credentials and setup details for the new production cluster.',
    active: true,
    tags: [
      { label: 'DevOps', tone: 'tag-blue' },
      { label: 'Sensitive', tone: 'tag-blue' }
    ]
  },
  {
    title: 'Q4 Product Strategy',
    date: 'Apr 20',
    summary: 'Key objectives and design principles for the upcoming quarter.',
    tags: [
      { label: 'Planning', tone: 'tag-gray' },
      { label: 'Design', tone: 'tag-gray' }
    ]
  },
  {
    title: 'Personal Vault',
    date: 'Apr 10',
    summary: 'Banking details and recovery codes.',
    tags: [{ label: 'Personal', tone: 'tag-gray' }]
  }
];

export const versionHistory = [
  {
    title: 'Current Version',
    date: 'Today, 2:30 PM'
  },
  {
    title: 'Added secret key',
    date: 'Apr 24, 2:30 PM',
    author: 'by You'
  },
  {
    title: 'Initial draft',
    date: 'Apr 22, 9:15 AM',
    author: 'by You'
  }
];
