import type { TemplateManager } from '@blocksuite/affine/gfx/template';

import FiveWTwoH from './edgeless/5W2H.json';
import ConceptMap from './edgeless/Concept Map.json';
import Flowchart from './edgeless/Flowchart.json';
import SMART from './edgeless/SMART.json';
import SWOT from './edgeless/SWOT.json';
import FourPMarketingMatrix from './edgeless/4P Marketing Matrix.json';
import Storyboard from './edgeless/Storyboard.json';
import UserJourneyMap from './edgeless/User Journey Map.json';
import BusinessProposal from './edgeless/Business Proposal.json';
import DataAnalysis from './edgeless/Data Analysis.json';
import SimplePresentation from './edgeless/Simple Presentation.json';
import FishboneDiagram from './edgeless/Fishbone Diagram.json';
import GanttChart from './edgeless/Gantt Chart.json';
import MonthlyCalendar from './edgeless/Monthly Calendar.json';
import ProjectPlanning from './edgeless/Project Planning.json';
import ProjectTrackingKanban from './edgeless/Project Tracking Kanban.json';

const templates: Record<string, unknown[]> = {
  'Brainstorming': [FiveWTwoH, ConceptMap, Flowchart, SMART, SWOT],
  'Marketing': [FourPMarketingMatrix, Storyboard, UserJourneyMap],
  'Presentation': [BusinessProposal, DataAnalysis, SimplePresentation],
  'Project Management': [FishboneDiagram, GanttChart, MonthlyCalendar, ProjectPlanning, ProjectTrackingKanban],
};

function lcs(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export const peakEdgelessTemplates: TemplateManager = {
  list: async (category: string) => {
    return (templates[category] ?? []) as any[];
  },

  categories: async () => {
    return Object.keys(templates);
  },

  search: async (query: string) => {
    const results: unknown[] = [];
    query = query.toLowerCase();
    for (const list of Object.values(templates)) {
      for (const t of list) {
        const name = (t as any).name;
        if (name && lcs(query, name.toLowerCase()) === query.length) {
          results.push(t);
        }
      }
    }
    return results as any[];
  },
};
