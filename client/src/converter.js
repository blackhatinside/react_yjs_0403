import { nodesMap, edgesMap, metadataMap } from './yjsSetup';

// Convert from ReactFlow format to Rule Engine DSL
export const convertFlowToRuleEngineDSL = (graph, tenantID) => {
  console.log("Converting the react flow JSON to Rule Engine DSL");

  const ruleNodes = [];
  const connections = [];
  const parentSingleBlockNodeIds = [];
  let defaultNode = null;
  let isDefaultNode = false;
  let parentConditionalBlock = null;

  // Process nodes
  graph.nodes.forEach(node => {
    if (node.type === "group-block-node") {
      node.data.metadata.edges.forEach(edge => {
        connections.push({
          fromId: edge.source,
          toId: edge.target,
          type: "True"
        });
      });

      node.data.metadata.nodes.forEach(grpNode => {
        const ruleNode = graphNodeToRuleNode(grpNode, false);
        ruleNodes.push(ruleNode);
      });
    } else if (node.type === "conditional-node" || node.type === "conditional-gpt-node") {
      node.data.metadata.blocks.forEach(condNode => {
        condNode.nodeData.id = condNode.id;
        if (condNode.nodeData.type === "group_block") {
          condNode.nodeData.metadata.nodes.forEach(grpNode => {
            const ruleNode = graphNodeToRuleNode(grpNode, false);
            ruleNodes.push(ruleNode);
          });
        }
        
        if (condNode.nodeData.type !== "") {
          const ruleNode = graphNodeToRuleNode(condNode.nodeData, true);
          ruleNodes.push(ruleNode);
        }
      });

      if (!parentConditionalBlock) {
        parentConditionalBlock = node;
      }
    } else if (node.type === "response-node") {
      node.data.metadata.blocks.forEach(condNode => {
        condNode.nodeData.id = condNode.id;
        if (condNode.nodeData.type === "group_block") {
          condNode.nodeData.metadata.nodes.forEach(grpNode => {
            const ruleNode = graphNodeToRuleNode(grpNode, false);
            ruleNodes.push(ruleNode);
          });
        }
        
        if (condNode.nodeData.type !== "") {
          const ruleNode = graphNodeToRuleNode(condNode.nodeData, true);
          ruleNodes.push(ruleNode);
        }
      });
    } else if (node.type === "default-block-node") {
      isDefaultNode = true;
      node.data.metadata.blocks.forEach(condNode => {
        if (!condNode.isSelected) {
          return;
        }
        
        condNode.nodeData.id = condNode.id;
        if (condNode.nodeData.type === "group_block") {
          condNode.nodeData.metadata.nodes.forEach(grpNode => {
            const ruleNode = graphNodeToRuleNode(grpNode, false);
            ruleNodes.push(ruleNode);
          });
        }
        
        if (condNode.nodeData.type !== "") {
          const ruleNode = graphNodeToRuleNode(condNode.nodeData, true);
          ruleNodes.push(ruleNode);
        }
      });
      
      defaultNode = graphNodeToRuleNode(node, false);
      return;
    } else {
      node.tenantId = tenantID;
      parentSingleBlockNodeIds.push(node.id);
      const ruleNode = graphNodeToRuleNode(node, false);
      
      if (isDefaultNode && !defaultNode) {
        defaultNode = ruleNode;
      }
      
      ruleNodes.push(ruleNode);
    }
  });

  // Process edges
  graph.edges.forEach(edge => {
    let connection;
    
    if (typeof graph.id === 'number') {
      connection = {
        fromId: edge.source,
        toId: edge.target,
        type: "True"
      };
    } else {
      connection = {
        fromId: edge.sourceHandle ? edge.sourceHandle.split('_')[0] : edge.source,
        toId: edge.target,
        type: "True"
      };
    }
    
    connections.push(connection);
  });

  // Create the root node
  if (typeof graph.id === 'number' && !isDefaultNode) {
    const ruleNode = {
      id: String(graph.id),
      type: "singleBlock",
      name: "Start Single Block",
      configuration: {
        nodeIdList: parentSingleBlockNodeIds,
        edges: graph.edges.map(edge => ({
          sourceNode: edge.source,
          targetNode: edge.target,
          operator: edge.data?.operator || ""
        }))
      }
    };
    
    ruleNodes.unshift(ruleNode);
  } else if (isDefaultNode) {
    defaultNode.id = String(graph.id);
    ruleNodes.unshift(defaultNode);
  } else if (parentConditionalBlock) {
    const index = ruleNodes.findIndex(node => node.id === parentConditionalBlock.id);
    if (index !== -1) {
      const node = ruleNodes[index];
      ruleNodes.splice(index, 1);
      ruleNodes.unshift(node);
    }
  }

  // Build the rule chain
  const ruleChain = {
    RuleChain: {
      ID: String(graph.id),
      Name: "test",
      Root: true,
      DebugMode: false,
      TenantID: tenantID,
      AdditionalInfo: {
        description: "Converted from Graph"
      }
    },
    Metadata: {
      FirstNodeIndex: 0,
      Nodes: ruleNodes,
      Connections: connections
    }
  };

  // Detect cycles
  const isCyclePresent = detectCycle(connections);
  if (isCyclePresent) {
    console.error("Cycle detected in the graph");
    // You might want to handle this error in your application
  }

  return ruleChain;
};

// Helper function to convert a graph node to a rule node
const graphNodeToRuleNode = (node, isBlockNode) => {
  if (node.type === "group-block-node" || node.type === "group_block") {
    node.type = "singleBlock";
    const ruleNode = {
      id: node.id,
      type: node.type,
      name: isBlockNode ? node.metadata?.name : node.data?.metadata?.name,
      configuration: metadataToConfiguration(isBlockNode ? node.metadata : node.data?.metadata)
    };
    
    ruleNode.configuration.nodeIdList = isBlockNode ? 
      getNodeIdsList(node.metadata.nodes) : 
      getNodeIdsList(node.data.metadata.nodes);
      
    ruleNode.configuration.edges = isBlockNode ? 
      graphEdgesToSingleBlockEdge(node.metadata.edges) : 
      graphEdgesToSingleBlockEdge(node.data.metadata.edges);
      
    ruleNode.configuration.is_not = isBlockNode ? node.isNot : node.data?.isNot;
    
    return ruleNode;
  } else if (node.type === "conditional-node") {
    node.type = "conditionalBlock";
    const ruleNode = {
      id: node.id,
      type: node.type,
      name: node.data?.metadata?.name,
      configuration: metadataToConfiguration(node.data?.metadata)
    };
    
    ruleNode.configuration.nodeIdList = getBlockNodeIdsList(
      node.data.metadata.blocks, 
      false
    );
    
    ruleNode.configuration.is_not = isBlockNode ? node.isNot : node.data?.isNot;
    
    return ruleNode;
  } else if (node.type === "conditional-gpt-node") {
    node.type = "conditionalGPTBlock";
    const ruleNode = {
      id: node.id,
      type: node.type,
      name: node.data?.metadata?.name,
      configuration: metadataToConfiguration(node.data?.metadata)
    };
    
    ruleNode.configuration.nodeIdList = getBlockNodeIdsList(
      node.data.metadata.blocks, 
      false
    );
    
    ruleNode.configuration.prompt = node.data.metadata.prompt;
    ruleNode.configuration.momentNodeMap = getMomentNodeMap(
      node.data.metadata.blocks, 
      false
    );
    
    const groupNodeIDs = [];
    node.data.metadata.blocks.forEach(block => {
      if (block.nodeData.type === "group_block") {
        groupNodeIDs.push(block.id);
      }
    });
    
    ruleNode.configuration.tenantID = node.tenantId;
    ruleNode.configuration.groupNodeIDs = groupNodeIDs;
    ruleNode.configuration.is_not = isBlockNode ? node.isNot : node.data?.isNot;
    
    return ruleNode;
  } else if (node.type === "default-block-node") {
    node.type = "defaultBlock";
    const ruleNode = {
      id: node.id,
      type: node.type,
      name: node.data?.metadata?.name,
      configuration: metadataToConfiguration(node.data?.metadata)
    };
    
    ruleNode.configuration.nodeIdList = getBlockNodeIdsList(
      node.data.metadata.blocks, 
      true
    );
    
    ruleNode.configuration.is_not = isBlockNode ? node.isNot : node.data?.isNot;
    ruleNode.configuration.selected = node.data.metadata.selected;
    
    return ruleNode;
  } else if (node.type === "response-node") {
    node.type = "response";
    const ruleNode = {
      id: node.id,
      type: node.type,
      name: node.data?.metadata?.name,
      configuration: metadataToConfiguration(node.data?.metadata)
    };
    
    ruleNode.configuration.nodeIdList = getResponseBlockNodeIdsList(
      node.data.metadata.blocks
    );
    
    return ruleNode;
  } else if (node.data?.type === "parameter" || node.type === "parameter") {
    let ruleNode;
    
    if (node.type === "parameter") {
      node.type = "attribute";
      ruleNode = {
        id: node.id,
        type: node.type,
        name: node.metadata?.name,
        configuration: metadataToConfiguration(node.metadata)
      };
      
      ruleNode.configuration.attribute = [node.metadata?.response];
      ruleNode.configuration.parameter_id = node.metadata?.parameter;
      ruleNode.configuration.is_not = node.isNot;
    } else {
      node.data.type = "attribute";
      ruleNode = {
        id: node.id,
        type: node.data.type,
        name: node.data?.metadata?.name,
        configuration: metadataToConfiguration(node.data?.metadata)
      };
      
      ruleNode.configuration.attribute = [node.data?.metadata?.response];
      ruleNode.configuration.parameter_id = node.data?.metadata?.parameter;
      ruleNode.configuration.is_not = node.data?.isNot;
    }
    
    ruleNode.configuration.attribute_type = "parameter";
    return ruleNode;
  } else if (isBlockNode) {
    const ruleNode = {
      id: node.id,
      type: node.type,
      name: node.metadata?.name,
      configuration: metadataToConfiguration(node.metadata)
    };
    
    ruleNode.configuration.is_not = node.isNot;
    
    if (ruleNode.type === "function") {
      ruleNode.configuration.function_name = node.metadata?.functionType;
    }
    
    return ruleNode;
  } else {
    const ruleNode = {
      id: node.id,
      type: node.data?.type,
      name: node.data?.metadata?.name,
      configuration: metadataToConfiguration(node.data?.metadata)
    };
    
    ruleNode.configuration.is_not = isBlockNode ? node.isNot : node.data?.isNot;
    
    if (ruleNode.type === "function") {
      ruleNode.configuration.function_name = node.data?.metadata?.functionType;
    }
    
    return ruleNode;
  }
};

// Helper functions
const getNodeIdsList = (nodes) => {
  return nodes.map(node => node.id);
};

const getBlockNodeIdsList = (nodes, filterSelected) => {
  return nodes
    .filter(node => !filterSelected || node.isSelected)
    .map(node => node.id);
};

const getMomentNodeMap = (nodes, filterSelected) => {
  const momentNodeMap = {};
  
  nodes.forEach(node => {
    if (filterSelected && !node.isSelected) {
      return;
    }
    
    if (node.nodeData.type === "moment") {
      momentNodeMap[node.nodeData.metadata.id] = node.id;
    }
  });
  
  return momentNodeMap;
};

const getResponseBlockNodeIdsList = (nodes) => {
  const nodeIdsWithType = [];
  const nodeIdsWithoutType = [];
  
  nodes.forEach(node => {
    if (node.nodeData.type !== "") {
      nodeIdsWithType.push(node.id);
    } else {
      nodeIdsWithoutType.push(node.id);
    }
  });
  
  return [...nodeIdsWithType, ...nodeIdsWithoutType];
};

const graphEdgesToSingleBlockEdge = (edges) => {
  return edges.map(edge => ({
    sourceNode: edge.source,
    targetNode: edge.target,
    operator: edge.data?.operator || ""
  }));
};

const metadataToConfiguration = (metadata) => {
  if (!metadata) return {};
  
  const configuration = {};
  Object.entries(metadata).forEach(([key, value]) => {
    // Skip certain properties or handle them specially
    if (key !== 'nodes' && key !== 'edges' && key !== 'blocks') {
      configuration[key] = value;
    }
  });
  
  return configuration;
};

// Helper to detect cycles in the graph
const detectCycle = (edges) => {
  const graph = {};
  
  // Build adjacency list
  edges.forEach(edge => {
    if (!graph[edge.fromId]) {
      graph[edge.fromId] = [];
    }
    graph[edge.fromId].push(edge.toId);
  });
  
  const visited = {};
  const recursionStack = {};
  
  const isCyclicUtil = (nodeId) => {
    if (!visited[nodeId]) {
      visited[nodeId] = true;
      recursionStack[nodeId] = true;
      
      if (graph[nodeId]) {
        for (const neighbor of graph[nodeId]) {
          if (!visited[neighbor] && isCyclicUtil(neighbor)) {
            return true;
          } else if (recursionStack[neighbor]) {
            return true;
          }
        }
      }
    }
    
    recursionStack[nodeId] = false;
    return false;
  };
  
  for (const nodeId in graph) {
    if (isCyclicUtil(nodeId)) {
      return true;
    }
  }
  
  return false;
}; 