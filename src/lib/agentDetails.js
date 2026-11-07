// Explanations of predefined demo assessments, never real-time confidence scores.
export function agentDetails(board, node) {
  const byId = new Map(board.nodes.map(n => [n.id, n]));
  const routes = [];
  const isEvidence = s => ['verified', 'contradicts'].includes(s.kind) || /^(cites|quotes|checked against)$/.test(s.label || '');
  for (const edge of board.strings.filter(s => !s.claimed && isEvidence(s) && (s.from === node.id || s.to === node.id))) {
    const other = byId.get(edge.from === node.id ? edge.to : edge.from);
    if (!other) continue;
    routes.push({ node: other, edges: [edge] });
    if (other.type === 'note') for (const next of board.strings.filter(s => !s.claimed && isEvidence(s) && (s.from === other.id || s.to === other.id))) {
      const target = byId.get(next.from === other.id ? next.to : next.from);
      if (target && target.id !== node.id) routes.push({ node: target, edges: [edge, next] });
    }
  }
  const unique = [...new Map(routes.map(r => [r.node.id, r])).values()];
  const primary = unique.filter(r => r.node.platform === 'Government record');
  const ownPrimary = node.platform === 'Government record';
  const verdict = node.checks?.validity?.verdict;
  const strength = verdict === 'unverified' ? 'Insufficient evidence' : primary.length || ownPrimary ? 'Primary documentation available' : unique.length ? 'Related evidence linked' : 'Assessment explanation only';
  const strengthWhy = verdict === 'unverified' ? 'The current demo does not establish this claim. Related sources alone do not resolve it.' : primary.length || ownPrimary ? 'Official records are available for comparison. Read the stated reason to see whether they support or contradict the specific claim; this is not a certainty score.' : unique.length ? 'The map contains related checks, but their presence does not establish independent corroboration.' : 'No direct evidence trail is linked to this pin. The predefined verdict has not been independently substantiated by the graph.';
  const wording = String(node.title || '').match(/doesn't want you to know|BREAKING|ILLEGAL|coming for your|bankrolled|nobody is taking your|share before the vote|!!+/gi) || [];
  return { routes: unique, strength, strengthWhy, wording,
    reliability: ownPrimary ? 'Primary record: reliable for the wording or recorded action it contains. It cannot establish hidden motives, causation, or future outcomes on its own.' : node.type === 'shot' ? 'Screenshot: original URL and surrounding context may be missing. Provenance must be established separately.' : node.type === 'post' ? 'Social post: assess the individual claim against original records. Reach, tone, and political position do not determine factual accuracy.' : 'Reporting or source collection: compare its specific statements with the original records. This demo has no independent outlet reliability audit.',
    limitations: node.checks?.context || 'No additional missing-context finding is recorded for this source. Absence of a warning does not establish completeness.',
  };
}
