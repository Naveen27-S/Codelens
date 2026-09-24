/**
 * src/services/flowchartGenerator.ts
 *
 * Client-Side Mermaid Flowchart Diagram Generator.
 * Parses code structure (functions, loops, branches, return statements)
 * and outputs 100% valid, quoted Mermaid v11 flowchart syntax.
 */

export function generateClientFlowchart(code: string, language: string): string {
  if (!code || !code.trim()) {
    return 'flowchart TD\n    Start(("Start")) --> End(("End"))';
  }

  const lines = code.split('\n');
  const flowchartLines: string[] = ['flowchart TD'];
  let nodeCount = 0;

  const createNodeId = () => `N${++nodeCount}`;

  const startId = createNodeId();
  flowchartLines.push(`    ${startId}(("Start ${language.toUpperCase()} Program"))`);

  let prevNodeId = startId;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // Truncate long code line for label
    let cleanLabel = trimmed.replace(/"/g, "'");
    if (cleanLabel.length > 40) {
      cleanLabel = cleanLabel.substring(0, 37) + '...';
    }

    // Escape unsafe characters for HTML labels
    cleanLabel = cleanLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const nodeId = createNodeId();

    if (trimmed.startsWith('if ') || trimmed.startsWith('else if') || trimmed.startsWith('elif ') || trimmed.includes('?')) {
      // Decision Node (Diamond)
      flowchartLines.push(`    ${nodeId}{"${cleanLabel}"}`);
      flowchartLines.push(`    ${prevNodeId} --> ${nodeId}`);
      
      // Add branch nodes
      const trueId = createNodeId();
      flowchartLines.push(`    ${trueId}["Execute If Branch"]`);
      flowchartLines.push(`    ${nodeId} -- "True" --> ${trueId}`);
      prevNodeId = trueId;

    } else if (trimmed.startsWith('for ') || trimmed.startsWith('while ')) {
      // Loop Node — use trapezoid shape (stable in Mermaid v11)
      flowchartLines.push(`    ${nodeId}[/"Loop: ${cleanLabel}"/]`);
      flowchartLines.push(`    ${prevNodeId} --> ${nodeId}`);
      prevNodeId = nodeId;

    } else if (trimmed.startsWith('def ') || trimmed.startsWith('function ') || trimmed.startsWith('class ') || trimmed.startsWith('CREATE TABLE')) {
      // Function / Table Declaration (Subroutine)
      flowchartLines.push(`    ${nodeId}[["${cleanLabel}"]]`);
      flowchartLines.push(`    ${prevNodeId} --> ${nodeId}`);
      prevNodeId = nodeId;

    } else if (trimmed.startsWith('return ') || trimmed.startsWith('SELECT ')) {
      // Return / Query Result Node (Round)
      flowchartLines.push(`    ${nodeId}("${cleanLabel}")`);
      flowchartLines.push(`    ${prevNodeId} --> ${nodeId}`);
      prevNodeId = nodeId;

    } else {
      // Standard Statement (Rectangle)
      flowchartLines.push(`    ${nodeId}["${cleanLabel}"]`);
      flowchartLines.push(`    ${prevNodeId} --> ${nodeId}`);
      prevNodeId = nodeId;
    }

    // Limit diagram complexity to 15 nodes for visual clarity
    if (nodeCount >= 14) {
      const moreId = createNodeId();
      flowchartLines.push(`    ${moreId}["... ${lines.length - i - 1} more statements ..."]`);
      flowchartLines.push(`    ${prevNodeId} --> ${moreId}`);
      prevNodeId = moreId;
      break;
    }
  }

  const endId = createNodeId();
  flowchartLines.push(`    ${endId}(("End Program"))`);
  flowchartLines.push(`    ${prevNodeId} --> ${endId}`);

  return flowchartLines.join('\n');
}
