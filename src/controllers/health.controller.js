const gotenbergService = require('../services/gotenberg.service');

class HealthController {
  async getHealth(req, res) {
    const gotenbergHealth = await gotenbergService.checkHealth();
    const isHealthy = gotenbergHealth.status === 'healthy';

    const payload = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      services: {
        api: 'healthy',
        gotenberg: gotenbergHealth,
      },
    };

    res.status(isHealthy ? 200 : 503).json(payload);
  }
}

module.exports = new HealthController();

