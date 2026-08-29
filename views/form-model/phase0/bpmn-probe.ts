import BpmnModeler from 'bpmn-js/lib/Modeler';

export function createBpmnModeler(container: HTMLElement): BpmnModeler {
  return new BpmnModeler({ container });
}

export async function roundTripBpmn(
  container: HTMLElement,
  xml: string,
): Promise<string> {
  const modeler = createBpmnModeler(container);

  try {
    await modeler.importXML(xml);
    const result = await modeler.saveXML({ format: true });
    if (!result.xml) {
      throw new Error('BPMN export returned no XML');
    }
    return result.xml;
  } finally {
    modeler.destroy();
  }
}
