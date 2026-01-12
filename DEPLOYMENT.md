# CV999 Casino Platform - Production Deployment Guide

## Prerequisites
- Ubuntu 20.04/22.04 LTS
- Docker & Docker Compose
- Nginx (for production)
- SSL Certificate (Let's Encrypt)
- Domain name
- VPS with minimum 4GB RAM, 2 CPU cores

## 1. Server Setup

### Update System
```bash
sudo apt update && sudo apt upgrade -y