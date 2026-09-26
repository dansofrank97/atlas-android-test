targetScope = 'resourceGroup'

param location string = 'southafricanorth'
param appName string = 'atlas-cloud-api'
param environmentName string
param registryServer string
param pullIdentityId string
param image string
param aiBaseUrl string
param aiModel string
param enableWebSearch bool = false

@secure()
param aiApiKey string

@secure()
param mobileSharedToken string

resource containerEnvironment 'Microsoft.App/managedEnvironments@2025-07-01' existing = {
  name: environmentName
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: last(split(pullIdentityId, '/'))
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${pullIdentityId}': {}
    }
  }
  properties: {
    environmentId: containerEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: registryServer
          identity: pullIdentityId
        }
      ]
      secrets: [
        {
          name: 'atlas-ai-api-key'
          value: aiApiKey
        }
        {
          name: 'atlas-mobile-token'
          value: mobileSharedToken
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'atlas-cloud'
          image: image
          env: [
            {
              name: 'ATLAS_AI_BASE_URL'
              value: aiBaseUrl
            }
            {
              name: 'ATLAS_AI_MODEL'
              value: aiModel
            }
            {
              name: 'ATLAS_ENABLE_WEB_SEARCH'
              value: enableWebSearch ? 'true' : 'false'
            }
            {
              name: 'ATLAS_AI_API_KEY'
              secretRef: 'atlas-ai-api-key'
            }
            {
              name: 'ATLAS_MOBILE_SHARED_TOKEN'
              secretRef: 'atlas-mobile-token'
            }
            {
              name: 'ATLAS_AI_TIMEOUT_SECONDS'
              value: '45'
            }
            {
              name: 'PORT'
              value: '8080'
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8080
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 20
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 8080
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 5
        rules: [
          {
            name: 'http-scale'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output fqdn string = containerApp.properties.configuration.ingress.fqdn
output endpoint string = 'https://${containerApp.properties.configuration.ingress.fqdn}/v1/mobile/ask'
output appName string = containerApp.name
