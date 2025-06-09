package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

type BridgeService struct {
	clients    map[string]*ethclient.Client
	contracts  map[string]common.Address
	wsUpgrader websocket.Upgrader
	eventChan  chan BridgeEvent
}

type BridgeEvent struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	FromChain   string    `json:"fromChain"`
	ToChain     string    `json:"toChain"`
	Token       string    `json:"token"`
	Amount      string    `json:"amount"`
	Sender      string    `json:"sender"`
	Recipient   string    `json:"recipient"`
	TxHash      string    `json:"txHash"`
	BlockNumber uint64    `json:"blockNumber"`
	Nonce       string    `json:"nonce"`
	Status      string    `json:"status"`
	Timestamp   time.Time `json:"timestamp"`
}

type LockEvent struct {
	Token       common.Address
	Sender      common.Address
	TargetChain [32]byte
	TargetAddr  []byte
	Amount      *big.Int
	Nonce       [32]byte
}

func NewBridgeService() *BridgeService {
	return &BridgeService{
		clients:   make(map[string]*ethclient.Client),
		contracts: make(map[string]common.Address),
		wsUpgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
		eventChan: make(chan BridgeEvent, 100),
	}
}

func (bs *BridgeService) InitializeClients() error {
	// Initialize Ethereum client
	ethRPC := os.Getenv("ETHEREUM_RPC")
	if ethRPC == "" {
		ethRPC = "https://mainnet.infura.io/v3/" + os.Getenv("INFURA_API_KEY")
	}
	
	ethClient, err := ethclient.Dial(ethRPC)
	if err != nil {
		return fmt.Errorf("failed to connect to Ethereum: %v", err)
	}
	bs.clients["ethereum"] = ethClient
	bs.contracts["ethereum"] = common.HexToAddress("0x1234567890123456789012345678901234567890")

	// Initialize Polygon client
	polygonRPC := os.Getenv("POLYGON_RPC")
	if polygonRPC == "" {
		polygonRPC = "https://polygon-rpc.com/"
	}
	
	polygonClient, err := ethclient.Dial(polygonRPC)
	if err != nil {
		return fmt.Errorf("failed to connect to Polygon: %v", err)
	}
	bs.clients["polygon"] = polygonClient
	bs.contracts["polygon"] = common.HexToAddress("0x2345678901234567890123456789012345678901")

	// Initialize BSC client
	bscRPC := os.Getenv("BSC_RPC")
	if bscRPC == "" {
		bscRPC = "https://bsc-dataseed.binance.org/"
	}
	
	bscClient, err := ethclient.Dial(bscRPC)
	if err != nil {
		return fmt.Errorf("failed to connect to BSC: %v", err)
	}
	bs.clients["bsc"] = bscClient
	bs.contracts["bsc"] = common.HexToAddress("0x3456789012345678901234567890123456789012")

	return nil
}

func (bs *BridgeService) ListenToChain(ctx context.Context, chainName string) {
	client := bs.clients[chainName]
	contractAddr := bs.contracts[chainName]

	// Create filter for Lock events
	query := ethereum.FilterQuery{
		Addresses: []common.Address{contractAddr},
		Topics: [][]common.Hash{
			{crypto.Keccak256Hash([]byte("Locked(address,address,bytes32,bytes,uint256,bytes32)"))},
		},
	}

	logs := make(chan types.Log)
	sub, err := client.SubscribeFilterLogs(ctx, query, logs)
	if err != nil {
		log.Printf("Failed to subscribe to %s logs: %v", chainName, err)
		return
	}
	defer sub.Unsubscribe()

	log.Printf("Listening to %s bridge events...", chainName)

	for {
		select {
		case err := <-sub.Err():
			log.Printf("Error in %s subscription: %v", chainName, err)
			return
		case vLog := <-logs:
			bs.processLockEvent(chainName, vLog)
		case <-ctx.Done():
			return
		}
	}
}

func (bs *BridgeService) processLockEvent(chainName string, vLog types.Log) {
	lockEventABI := `[{"anonymous":false,"inputs":[{"indexed":true,"name":"token","type":"address"},{"indexed":true,"name":"sender","type":"address"},{"indexed":false,"name":"targetChain","type":"bytes32"},{"indexed":false,"name":"targetAddr","type":"bytes"},{"indexed":false,"name":"amount","type":"uint256"},{"indexed":false,"name":"nonce","type":"bytes32"}],"name":"Locked","type":"event"}]`

	contractABI, err := abi.JSON(strings.NewReader(lockEventABI))
	if err != nil {
		log.Printf("Failed to parse ABI: %v", err)
		return
	}

	var lockEvent LockEvent
	err = contractABI.UnpackIntoInterface(&lockEvent, "Locked", vLog.Data)
	if err != nil {
		log.Printf("Failed to unpack event: %v", err)
		return
	}

	targetChain := strings.TrimRight(string(lockEvent.TargetChain[:]), "\x00")
	bridgeEvent := BridgeEvent{
		ID:          fmt.Sprintf("%s-%s-%d", chainName, vLog.TxHash.Hex(), vLog.Index),
		Type:        "lock",
		FromChain:   chainName,
		ToChain:     targetChain,
		Token:       lockEvent.Token.Hex(),
		Amount:      lockEvent.Amount.String(),
		Sender:      lockEvent.Sender.Hex(),
		Recipient:   string(lockEvent.TargetAddr),
		TxHash:      vLog.TxHash.Hex(),
		BlockNumber: vLog.BlockNumber,
		Nonce:       fmt.Sprintf("0x%x", lockEvent.Nonce),
		Status:      "locked",
		Timestamp:   time.Now(),
	}

	bs.eventChan <- bridgeEvent
	log.Printf("Lock event detected: %s -> %s, Amount: %s", chainName, targetChain, lockEvent.Amount.String())
}

func (bs *BridgeService) ProcessBridgeEvents(ctx context.Context) {
	for {
		select {
		case event := <-bs.eventChan:
			bs.handleBridgeEvent(event)
		case <-ctx.Done():
			return
		}
	}
}

func (bs *BridgeService) handleBridgeEvent(event BridgeEvent) {
	switch event.Type {
	case "lock":
		go bs.initiateMint(event)
	case "mint":
		bs.updateTransactionStatus(event.ID, "completed")
	}
	bs.broadcastEvent(event)
}

func (bs *BridgeService) initiateMint(lockEvent BridgeEvent) {
	time.Sleep(5 * time.Second)

	targetClient, exists := bs.clients[lockEvent.ToChain]
	if !exists {
		log.Printf("No client for target chain: %s", lockEvent.ToChain)
		return
	}

	targetContract := bs.contracts[lockEvent.ToChain]
	mintTxHash := bs.simulateMintTransaction(targetClient, targetContract, lockEvent)

	mintEvent := BridgeEvent{
		ID:        lockEvent.ID,
		Type:      "mint",
		FromChain: lockEvent.FromChain,
		ToChain:   lockEvent.ToChain,
		Token:     lockEvent.Token,
		Amount:    lockEvent.Amount,
		Sender:    lockEvent.Sender,
		Recipient: lockEvent.Recipient,
		TxHash:    mintTxHash,
		Nonce:     lockEvent.Nonce,
		Status:    "completed",
		Timestamp: time.Now(),
	}

	bs.eventChan <- mintEvent
}

func (bs *BridgeService) simulateMintTransaction(client *ethclient.Client, contract common.Address, event BridgeEvent) string {
	return fmt.Sprintf("0x%064x", time.Now().UnixNano())
}

func (bs *BridgeService) updateTransactionStatus(id, status string) {
	payload := map[string]string{"id": id, "status": status}
	jsonData, _ := json.Marshal(payload)
	
	resp, err := http.Post("http://localhost:5000/api/bridge/update-status", 
		"application/json", strings.NewReader(string(jsonData)))
	
	if err != nil {
		log.Printf("Failed to update transaction status: %v", err)
		return
	}
	defer resp.Body.Close()
}

func (bs *BridgeService) broadcastEvent(event BridgeEvent) {
	log.Printf("Broadcasting event: %s", event.ID)
}

func (bs *BridgeService) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := bs.wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	log.Println("New WebSocket connection established")

	for {
		select {
		case event := <-bs.eventChan:
			if err := conn.WriteJSON(event); err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}
		}
	}
}

func (bs *BridgeService) handleBridgeStatus(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"status": "active",
		"chains": []string{"ethereum", "polygon", "bsc"},
		"uptime": time.Now().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func runBridgeService() {
	bridgeService := NewBridgeService()

	if err := bridgeService.InitializeClients(); err != nil {
		log.Fatal("Failed to initialize clients:", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go bridgeService.ListenToChain(ctx, "ethereum")
	go bridgeService.ListenToChain(ctx, "polygon")
	go bridgeService.ListenToChain(ctx, "bsc")
	go bridgeService.ProcessBridgeEvents(ctx)

	router := mux.NewRouter()
	router.HandleFunc("/ws", bridgeService.handleWebSocket)
	router.HandleFunc("/status", bridgeService.handleBridgeStatus)

	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}

	go func() {
		log.Println("Bridge service listening on :8080")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Server failed to start:", err)
		}
	}()

	log.Println("Go bridge service started successfully")
}