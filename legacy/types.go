package types

import (
	"encoding/json"

	"bitbucket.org/convin/go_services/rule_engine/api/types"
	"go.uber.org/zap"
)

type Position struct {
	X float32 `json:"x,omitempty" dynamodbav:"x,omitempty"`
	Y float32 `json:"y,omitempty" dynamodbav:"y,omitempty"`
}

type Data struct {
	Type     string   `json:"type,omitempty" dynamodbav:"type,omitempty"`
	IsNot    bool     `json:"is_not,omitempty" dynamodbav:"is_not,omitempty"`
	Metadata Metadata `json:"metadata,omitempty" dynamodbav:"metadata,omitempty"`
	Operator string   `json:"operator,omitempty" dynamodbav:"operator,omitempty"`
	Selected int32    `json:"selected,omitempty" dynamodbav:"selected,omitempty"`
}

type ValidateFields struct {
	AttributeCategoryKey int32  `json:"attributeCategoryKey,omitempty" dynamodbav:"attributeCategoryKey"`
	Entity               int32  `json:"entity,omitempty" dynamodbav:"entity"`
	DataType             string `json:"dataType,omitempty" dynamodbav:"dataType"`
}

type Metadata struct {
	Name          string        `json:"name,omitempty" dynamodbav:"name"`
	AttributeType string        `json:"attribute_type,omitempty" dynamodbav:"attribute_type"`
	Attribute     []interface{} `json:"attribute,omitempty" dynamodbav:"attribute"`
	ID            string        `json:"id,omitempty" dynamodbav:"id"`
	Nodes         []Node        `json:"nodes,omitempty" dynamodbav:"nodes"`
	Edges         []Edge        `json:"edges,omitempty" dynamodbav:"edges"`
	Operator      string        `json:"operator,omitempty" dynamodbav:"operator"`
	Parameter     int           `json:"parameter,omitempty" dynamodbav:"parameter"`
	Response      int           `json:"response,omitempty" dynamodbav:"response"`
	Blocks        []BlockNode   `json:"blocks,omitempty" dynamodbav:"blocks"`
	Max           int           `json:"max,omitempty" dynamodbav:"max"`
	Min           int           `json:"min,omitempty" dynamodbav:"min"`
	FunctionType  string        `json:"function_type,omitempty" dynamodbav:"function_type"`
	Selected      int32         `json:"selected,omitempty" dynamodbav:"selected"`
	Prompt        string        `json:"prompt,omitempty" dynamodbav:"prompt"`
	// Information Correction Keys
	AttributeCategoryKey int32         `json:"attributeCategoryKey,omitempty" dynamodbav:"attributeCategoryKey"`
	Entity               int32         `json:"entity,omitempty" dynamodbav:"entity"`
	DataType             string        `json:"dataType,omitempty" dynamodbav:"dataType"`
	RelativeOperation    string        `json:"relativeOperation,omitempty" dynamodbav:"relativeOperation"`
	Value                interface{}   `json:"value,omitempty" dynamodbav:"value"`
	RelativeDays         int           `json:"relativeDays,omitempty" dynamodbav:"relativeDays"`
	AttributeCategory    int32         `json:"attributeCategory,omitempty" dynamodbav:"attributeCategory"`
	List                 []interface{} `json:"list,omitempty" dynamodbav:"list"`
	// Allowing Attrubute-Attrbiute and Entity-Entity validation
	Validate           string         `json:"validate,omitempty" dynamodbav:"validate"`
	ValidateFields     ValidateFields `json:"validateFields,omitempty" dynamodbav:"validateFields"`
	ValidateWith       string         `json:"validateWith,omitempty" dynamodbav:"validateWith"`
	ValidateWithFields ValidateFields `json:"validateWithFields,omitempty" dynamodbav:"validateWithFields"`
}

type Node struct {
	ID               string   `json:"id,omitempty" dynamodbav:"node_id"`
	BlockName        string   `json:"block_name,omitempty" dynamodbav:"block_name"`
	Position         Position `json:"position,omitempty" dynamodbav:"-"`
	Data             Data     `json:"data,omitempty" dynamodbav:"data,omitempty"`
	Connectable      bool     `json:"connectable,omitempty" dynamodbav:"-"`
	Type             string   `json:"type,omitempty" dynamodbav:"type,omitempty"`
	TargetPosition   string   `json:"targetPosition,omitempty" dynamodbav:"-"`
	Draggable        bool     `json:"draggable,omitempty" dynamodbav:"-"`
	Width            int      `json:"width,omitempty" dynamodbav:"-"`
	Height           int      `json:"height,omitempty" dynamodbav:"-"`
	Selected         bool     `json:"selected,omitempty" dynamodbav:"selected,omitempty"`
	SourcePosition   string   `json:"sourcePosition,omitempty" dynamodbav:"-"`
	PositionAbsolute Position `json:"positionAbsolute,omitempty" dynamodbav:"-"`
	Metadata         Metadata `json:"metadata,omitempty" dynamodbav:"metadata,omitempty"`
	IsNot            bool     `json:"is_not,omitempty" dynamodbav:"is_not,omitempty"`
	TenantId         string   `json:"tenant_id,omitempty" dynamodbav:"tenant_id"`
	Operator         string   `json:"operator,omitempty" dynamodbav:"operator"`
}

type BlockNode struct {
	ID         string `json:"id,omitempty" dynamodbav:"id,omitempty"`
	NodeData   Node   `json:"data,omitempty" dynamodbav:"data,omitempty"`
	IsSelected bool   `json:"is_selected,omitempty" dynamodbav:"is_selected,omitempty"`
}

type Edge struct {
	ID           string                 `json:"id,omitempty" dynamodbav:"id,omitempty"`
	SourceHandle string                 `json:"sourceHandle,omitempty" dynamodbav:"sourceHandle,omitempty"`
	Source       string                 `json:"source,omitempty" dynamodbav:"source,omitempty"`
	Target       string                 `json:"target,omitempty" dynamodbav:"target,omitempty"`
	TargetHandle string                 `json:"targetHandle,omitempty" dynamodbav:"targetHandle,omitempty"`
	Type         string                 `json:"type,omitempty" dynamodbav:"type,omitempty"`
	Data         Data                   `json:"data,omitempty" dynamodbav:"data,omitempty"`
	Style        map[string]interface{} `json:"style,omitempty" dynamodbav:"-"`
}

type Graph struct {
	Nodes []Node      `json:"nodes,omitempty" dynamodbav:"nodes,omitempty"`
	Edges []Edge      `json:"edges,omitempty" dynamodbav:"edges,omitempty"`
	ID    interface{} `json:"id,omitempty" dynamodbav:"id,omitempty"`
}

func MetadataToGraph(metadata Metadata) Graph {
	return Graph{
		Nodes: metadata.Nodes,
		Edges: metadata.Edges,
	}
}

func MetadataToConfiguration(metadata Metadata) types.Configuration {
	jsonData, err := json.Marshal(metadata)
	if err != nil {
		zap.L().Error("Error marshaling JSON:", zap.Error(err))
		return nil
	}
	var configuration = make(map[string]interface{})
	err = json.Unmarshal(jsonData, &configuration)
	if err != nil {
		zap.L().Error("Error unmarshaling JSON:", zap.Error(err))
		return nil
	}
	return configuration
}

type PaginationPayload struct {
	Filters          string `json:"filters"`
	Offset           int    `json:"offset"`
	PageSize         int    `json:"page_size"`
	LastEvaluatedKey string `json:"last_evaluated_key"`
	ReturnCount      bool   `json:"return_count"`
}
