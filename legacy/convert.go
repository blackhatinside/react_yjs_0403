package reactflow

import (
	"context"
	"fmt"
	"reflect"
	"strings"

	"bitbucket.org/convin/go_services/rule_engine/api/types"
	"bitbucket.org/convin/go_services/rule_engine/configs"
	"bitbucket.org/convin/go_services/rule_engine/internal/repository/dynamodb"
	reactFlowTypes "bitbucket.org/convin/go_services/rule_engine/internal/types"
	"bitbucket.org/convin/go_services/rule_engine/pkg/model"
	"go.uber.org/zap"
)

func graphEdgesToSingleBlockEdge(edges []reactFlowTypes.Edge) []map[string]string {
	var singleBlockEdges []map[string]string
	for _, edge := range edges {
		singleBlockEdge := map[string]string{
			"SourceNode": edge.Source,
			"TargetNode": edge.Target,
			"Operator":   edge.Data.Operator,
		}
		singleBlockEdges = append(singleBlockEdges, singleBlockEdge)
	}
	return singleBlockEdges
}

func getNodeIdsList(nodes []reactFlowTypes.Node) []string {
	nodeIdsList := []string{}
	for _, node := range nodes {
		nodeIdsList = append(nodeIdsList, node.ID)
	}
	return nodeIdsList
}

func getBlockNodeIdsList(nodes []reactFlowTypes.BlockNode, filterSelected bool) []string {
	nodeIdsList := []string{}
	for _, node := range nodes {
		if filterSelected && !node.IsSelected {
			continue
		}
		nodeIdsList = append(nodeIdsList, node.ID)
	}
	return nodeIdsList
}

func getMomentNodeMap(nodes []reactFlowTypes.BlockNode, filterSelected bool) map[string]string {
	MomentNodeMap := make(map[string]string)
	for _, node := range nodes {
		if filterSelected && !node.IsSelected {
			continue
		}
		if node.NodeData.Type == "moment" {
			MomentNodeMap[node.NodeData.Metadata.ID] = node.ID
		}
	}
	return MomentNodeMap
}

func getResponseBlockNodeIdsList(nodes []reactFlowTypes.BlockNode) []string {
	nodeIdsList := []string{}
	for _, node := range nodes {
		if node.NodeData.Type != "" {
			nodeIdsList = append(nodeIdsList, node.ID)
		}
	}
	for _, node := range nodes {
		if node.NodeData.Type == "" {
			nodeIdsList = append(nodeIdsList, node.ID)
		}
	}
	return nodeIdsList
}

func graphNodeToRuleNode(node reactFlowTypes.Node, isBlockNode bool) *types.RuleNode {
	if node.Type == "group-block-node" {
		node.Type = "singleBlock"
		ruleNode := &types.RuleNode{
			Id:            node.ID,
			Type:          node.Type,
			Name:          node.Data.Metadata.Name,
			Configuration: reactFlowTypes.MetadataToConfiguration(node.Data.Metadata),
		}
		ruleNode.Configuration["NodeIdList"] = getNodeIdsList(node.Data.Metadata.Nodes)
		ruleNode.Configuration["edges"] = graphEdgesToSingleBlockEdge(node.Data.Metadata.Edges)
		if isBlockNode {
			ruleNode.Configuration["is_not"] = node.IsNot
		} else {
			ruleNode.Configuration["is_not"] = node.Data.IsNot
		}
		return ruleNode
	}
	if node.Type == "group_block" {
		node.Type = "singleBlock"
		ruleNode := &types.RuleNode{
			Id:            node.ID,
			Type:          node.Type,
			Name:          node.Metadata.Name,
			Configuration: reactFlowTypes.MetadataToConfiguration(node.Metadata),
		}
		ruleNode.Configuration["NodeIdList"] = getNodeIdsList(node.Metadata.Nodes)
		ruleNode.Configuration["edges"] = graphEdgesToSingleBlockEdge(node.Metadata.Edges)
		if isBlockNode {
			ruleNode.Configuration["is_not"] = node.IsNot
		} else {
			ruleNode.Configuration["is_not"] = node.Data.IsNot
		}
		return ruleNode
	}
	if node.Type == "conditional-node" {
		node.Type = "conditionalBlock"
		ruleNode := &types.RuleNode{
			Id:            node.ID,
			Type:          node.Type,
			Name:          node.Data.Metadata.Name,
			Configuration: reactFlowTypes.MetadataToConfiguration(node.Data.Metadata),
		}
		ruleNode.Configuration["NodeIdList"] = getBlockNodeIdsList(node.Data.Metadata.Blocks, false)
		if isBlockNode {
			ruleNode.Configuration["is_not"] = node.IsNot
		} else {
			ruleNode.Configuration["is_not"] = node.Data.IsNot
		}
		return ruleNode
	}
	if node.Type == "conditional-gpt-node" {
		node.Type = "conditionalGPTBlock"
		ruleNode := &types.RuleNode{
			Id:            node.ID,
			Type:          node.Type,
			Name:          node.Data.Metadata.Name,
			Configuration: reactFlowTypes.MetadataToConfiguration(node.Data.Metadata),
		}
		ruleNode.Configuration["NodeIdList"] = getBlockNodeIdsList(node.Data.Metadata.Blocks, false)
		ruleNode.Configuration["prompt"] = node.Data.Metadata.Prompt
		ruleNode.Configuration["MomentNodeMap"] = getMomentNodeMap(node.Data.Metadata.Blocks, false)
		var groupNodeIDs []string
		for _, block := range node.Data.Metadata.Blocks {
			if block.NodeData.Type == "group_block" {
				groupNodeIDs = append(groupNodeIDs, block.ID)
			}
		}
		ruleNode.Configuration["TenantID"] = node.TenantId
		ruleNode.Configuration["GroupNodeIDs"] = groupNodeIDs
		if isBlockNode {
			ruleNode.Configuration["is_not"] = node.IsNot
		} else {
			ruleNode.Configuration["is_not"] = node.Data.IsNot
		}
		return ruleNode
	}
	if node.Type == "default-block-node" {
		node.Type = "defaultBlock"
		ruleNode := &types.RuleNode{
			Id:            node.ID,
			Type:          node.Type,
			Name:          node.Data.Metadata.Name,
			Configuration: reactFlowTypes.MetadataToConfiguration(node.Data.Metadata),
		}
		ruleNode.Configuration["NodeIdList"] = getBlockNodeIdsList(node.Data.Metadata.Blocks, true)
		if isBlockNode {
			ruleNode.Configuration["is_not"] = node.IsNot
		} else {
			ruleNode.Configuration["is_not"] = node.Data.IsNot
		}
		ruleNode.Configuration["selected"] = node.Data.Metadata.Selected
		return ruleNode
	}
	if node.Type == "response-node" {
		node.Type = "response"
		ruleNode := &types.RuleNode{
			Id:            node.ID,
			Type:          node.Type,
			Name:          node.Data.Metadata.Name,
			Configuration: reactFlowTypes.MetadataToConfiguration(node.Data.Metadata),
		}
		ruleNode.Configuration["NodeIdList"] = getResponseBlockNodeIdsList(node.Data.Metadata.Blocks)
		return ruleNode
	}
	if node.Data.Type == "parameter" || node.Type == "parameter" {
		var ruleNode *types.RuleNode
		if node.Type == "parameter" {
			node.Type = "attribute"
			ruleNode = &types.RuleNode{
				Id:            node.ID,
				Type:          node.Type,
				Name:          node.Metadata.Name,
				Configuration: reactFlowTypes.MetadataToConfiguration(node.Metadata),
			}
			ruleNode.Configuration["attribute"] = []int{node.Metadata.Response}
			ruleNode.Configuration["parameter_id"] = node.Metadata.Parameter
			ruleNode.Configuration["is_not"] = node.IsNot
		} else {
			node.Data.Type = "attribute"
			ruleNode = &types.RuleNode{
				Id:            node.ID,
				Type:          node.Data.Type,
				Name:          node.Data.Metadata.Name,
				Configuration: reactFlowTypes.MetadataToConfiguration(node.Data.Metadata),
			}
			ruleNode.Configuration["attribute"] = []int{node.Data.Metadata.Response}
			ruleNode.Configuration["parameter_id"] = node.Data.Metadata.Parameter
			ruleNode.Configuration["is_not"] = node.Data.IsNot
		}
		ruleNode.Configuration["attribute_type"] = "parameter"
		return ruleNode
	}
	if isBlockNode {
		ruleNode := &types.RuleNode{
			Id:            node.ID,
			Type:          node.Type,
			Name:          node.Metadata.Name,
			Configuration: reactFlowTypes.MetadataToConfiguration(node.Metadata),
		}
		ruleNode.Configuration["is_not"] = node.IsNot
		if ruleNode.Type == "function" {
			ruleNode.Configuration["function_name"] = node.Metadata.FunctionType
		}
		return ruleNode
	}
	ruleNode := &types.RuleNode{
		Id:            node.ID,
		Type:          node.Data.Type,
		Name:          node.Data.Metadata.Name,
		Configuration: reactFlowTypes.MetadataToConfiguration(node.Data.Metadata),
	}
	if isBlockNode {
		ruleNode.Configuration["is_not"] = node.IsNot
	} else {
		ruleNode.Configuration["is_not"] = node.Data.IsNot
	}
	if ruleNode.Type == "function" {
		ruleNode.Configuration["function_name"] = node.Data.Metadata.FunctionType
	}
	return ruleNode
}

func ConvertFlowToRuleEngineDSL(graph reactFlowTypes.Graph, tenantID string) (types.RuleChain, error) {
	zap.L().Info("Converting the react flow JSON to Rule Engine DSL")
	var ruleNodes []*types.RuleNode
	var connections []types.NodeConnection
	var parentSingleBlockNodeIds []string
	var defaultNode *types.RuleNode
	isDefaultNode := false
	// Check if graph.ID is of type int

	var parentConditionalBlock *reactFlowTypes.Node

	for _, node := range graph.Nodes {
		if node.Type == "group-block-node" {
			for _, edge := range node.Data.Metadata.Edges {
				connection := types.NodeConnection{
					FromId: edge.Source,
					ToId:   edge.Target,
					Type:   "True",
				}
				connections = append(connections, connection)
			}
			for _, grpNode := range node.Data.Metadata.Nodes {
				ruleNode := graphNodeToRuleNode(grpNode, false)
				ruleNodes = append(ruleNodes, ruleNode)
			}
		}
		if node.Type == "conditional-node" || node.Type == "conditional-gpt-node" {
			for _, condNode := range node.Data.Metadata.Blocks {
				condNode.NodeData.ID = condNode.ID
				if condNode.NodeData.Type == "group_block" {
					for _, grpNode := range condNode.NodeData.Metadata.Nodes {
						ruleNode := graphNodeToRuleNode(grpNode, false)
						ruleNodes = append(ruleNodes, ruleNode)
					}
				}
				if condNode.NodeData.Type == "" {
					// Ignore the node if the type is empty
					continue
				}
				ruleNode := graphNodeToRuleNode(condNode.NodeData, true)
				ruleNodes = append(ruleNodes, ruleNode)
			}
			if parentConditionalBlock == nil {
				parentConditionalBlock = &node
			}
		}
		if node.Type == "response-node" {
			for _, condNode := range node.Data.Metadata.Blocks {
				condNode.NodeData.ID = condNode.ID
				if condNode.NodeData.Type == "group_block" {
					for _, grpNode := range condNode.NodeData.Metadata.Nodes {
						ruleNode := graphNodeToRuleNode(grpNode, false)
						ruleNodes = append(ruleNodes, ruleNode)
					}
				}
				if condNode.NodeData.Type == "" {
					// Ignore the node if the type is empty
					continue
				}
				ruleNode := graphNodeToRuleNode(condNode.NodeData, true)
				ruleNodes = append(ruleNodes, ruleNode)
			}
		}
		if node.Type == "default-block-node" {
			isDefaultNode = true
			for _, condNode := range node.Data.Metadata.Blocks {
				if !condNode.IsSelected {
					continue
				}
				condNode.NodeData.ID = condNode.ID
				if condNode.NodeData.Type == "group_block" {
					for _, grpNode := range condNode.NodeData.Metadata.Nodes {
						ruleNode := graphNodeToRuleNode(grpNode, false)
						ruleNodes = append(ruleNodes, ruleNode)
					}
				}
				if condNode.NodeData.Type == "" {
					// Ignore the node if the type is empty
					continue
				}
				ruleNode := graphNodeToRuleNode(condNode.NodeData, true)
				ruleNodes = append(ruleNodes, ruleNode)
			}
			defaultNode = graphNodeToRuleNode(node, false)
			continue
		}
		node.TenantId = tenantID
		parentSingleBlockNodeIds = append(parentSingleBlockNodeIds, node.ID)
		ruleNode := graphNodeToRuleNode(node, false)
		if isDefaultNode && defaultNode == nil {
			defaultNode = ruleNode
		}
		ruleNodes = append(ruleNodes, ruleNode)
	}

	var extraConnections []types.NodeConnection
	for _, edge := range graph.Edges {
		var connection types.NodeConnection
		if reflect.TypeOf(graph.ID).Kind() == reflect.Float64 {
			connection = types.NodeConnection{
				FromId: edge.Source,
				ToId:   edge.Target,
				Type:   "True",
			}
		} else {
			connection = types.NodeConnection{
				FromId: strings.Split(edge.SourceHandle, "_")[0],
				ToId:   edge.Target,
				Type:   "True",
			}
			extraConnections = append(extraConnections, types.NodeConnection{
				FromId: edge.Source,
				ToId:   edge.Target,
				Type:   "True",
			})
		}
		connections = append(connections, connection)
	}

	if reflect.TypeOf(graph.ID).Kind() == reflect.Float64 && !isDefaultNode {
		ruleNode := &types.RuleNode{
			Id:            fmt.Sprintf("%v", graph.ID),
			Type:          "singleBlock",
			Name:          "Start Single Block",
			Configuration: map[string]interface{}{},
		}
		ruleNode.Configuration["NodeIdList"] = parentSingleBlockNodeIds
		ruleNode.Configuration["edges"] = graphEdgesToSingleBlockEdge(graph.Edges)
		// Insert the start single block node at the beginning of the ruleNodes slice
		ruleNodes = append([]*types.RuleNode{ruleNode}, ruleNodes...)
	} else if isDefaultNode {
		defaultNode.Id = fmt.Sprintf("%v", graph.ID)
		ruleNodes = append([]*types.RuleNode{defaultNode}, ruleNodes...)
	} else {
		for i, node := range ruleNodes {
			if node.Id == parentConditionalBlock.ID {
				ruleNodes = append([]*types.RuleNode{node}, append(ruleNodes[:i], ruleNodes[i+1:]...)...)
				break
			}
		}
	}

	ruleChain := types.RuleChain{
		RuleChain: types.RuleChainBaseInfo{
			ID:        fmt.Sprintf("%v", graph.ID),
			Name:      "test",
			Root:      true,
			DebugMode: false,
			TenantID:  tenantID,
			AdditionalInfo: map[string]string{
				"description": "Converted from Graph",
			},
		},
		Metadata: types.RuleMetadata{
			FirstNodeIndex: 0,
			Nodes:          ruleNodes,
			Connections:    connections,
		},
	}

	// if ruleChain.RuleChain.ID == "multiple" {
	// 	fmt.Println("RuleChain ID is multiple")
	// }
	edges := ruleChain.Metadata.Connections
	if ruleChain.RuleChain.ID == "multiple" {
		edges = append(edges, extraConnections...)
	}
	isCyclePresent := detectCycle(edges)
	if isCyclePresent {
		return ruleChain, fmt.Errorf("cycle detected in the graph")
	}

	// var ruleChainJSON []byte
	// ruleChainJSON, err := json.Marshal(ruleChain)
	// if err != nil {
	// 	return ruleChain, err
	// }
	// fmt.Println("\n\n")
	// fmt.Println(string(ruleChainJSON))
	// fmt.Println("\n\n")

	return ruleChain, nil
}

func GetRuleMetadata(ruleChains []types.RuleChain, parameterID int32, tenantID string) (map[string]interface{}, error) {
	// TODO: Optimize this
	metadata := make(map[string]interface{})
	dependentParameters := []int{}
	momentIDs := []string{}
	for _, ruleChain := range ruleChains {
		for _, node := range ruleChain.Metadata.Nodes {
			if node.Type == "attribute" {
				attributeType, ok := node.Configuration["attribute_type"]
				if ok && attributeType == "parameter" {
					dependentParameters = append(dependentParameters, node.Configuration["parameter_id"].(int))
				}
			}
			if node.Type == "moment" {
				momentID, ok := node.Configuration["id"]
				if ok {
					momentIDs = append(momentIDs, momentID.(string))
				} else {
					return nil, fmt.Errorf("moment id not found")
				}
			}
		}
	}
	metadata["dependent_parameters"] = dependentParameters
	metadata["parameter_id"] = parameterID
	if len(momentIDs) == 0 {
		return metadata, nil
	}
	config := configs.GetAppConfig()
	repo, err := dynamodb.NewRepository(&config, false)
	if err != nil {
		return nil, err
	}
	// Do it batches of 90 moments at a time
	momentBatches := [][]string{}
	for i := 0; i < len(momentIDs); i += 90 {
		if i+90 > len(momentIDs) {
			momentBatches = append(momentBatches, momentIDs[i:])
		} else {
			momentBatches = append(momentBatches, momentIDs[i:i+90])
		}
	}
	var moments []model.Moment
	for _, momentBatch := range momentBatches {

		momentsBatch, err := repo.BatchGetMoments(context.TODO(), momentBatch, tenantID)
		if err != nil {
			return nil, err
		}
		for _, moment := range momentsBatch {
			moments = append(moments, *moment)
		}
	}
	dependentMoments := []string{}
	momentIDs = []string{}
	momentEdges := []model.MomentEdge{}
	for _, moment := range moments {
		if moment.MomentID != "" {
			dependentMoments = append(dependentMoments, moment.MomentID)
			momentEdges = append(momentEdges, model.MomentEdge{
				Source: moment.MomentID,
				Target: moment.ID,
			})
		}
		momentIDs = append(momentIDs, moment.ID)
	}
	metadata["dependent_moments"] = dependentMoments
	metadata["moment_ids"] = momentIDs
	metadata["moment_edges"] = momentEdges
	return metadata, nil
}
