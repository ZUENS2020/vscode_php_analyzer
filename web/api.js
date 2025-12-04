// API client for communicating with the graph server

const API_BASE_URL = window.location.origin;

class GraphAPI {
    constructor() {
        this.baseUrl = API_BASE_URL;
    }

    async fetchGraphData(type) {
        try {
            const response = await fetch(`${this.baseUrl}/api/graph/${type}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${type} graph:`, error);
            throw error;
        }
    }

    async fetchCodeGraph() {
        return this.fetchGraphData('code');
    }

    async fetchInheritanceGraph() {
        return this.fetchGraphData('inheritance');
    }

    async fetchDataFlowGraph() {
        return this.fetchGraphData('dataflow');
    }

    async fetchAttackChainGraph() {
        return this.fetchGraphData('attackchain');
    }

    async fetchAnalysis(fileHash) {
        try {
            const response = await fetch(`${this.baseUrl}/api/analysis/${fileHash}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching analysis:', error);
            throw error;
        }
    }

    async submitAnalysis(fileHash, data) {
        try {
            const response = await fetch(`${this.baseUrl}/api/analysis`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fileHash, data })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error submitting analysis:', error);
            throw error;
        }
    }

    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error checking server health:', error);
            throw error;
        }
    }
}

// Export singleton instance
const api = new GraphAPI();
