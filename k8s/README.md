# Kubernetes Deployment

This folder contains a basic Kubernetes deployment for the Hurgelt backend.

## Included resources

- `Namespace`
- `ConfigMap`
- `Secret`
- `PersistentVolumeClaim` for PostgreSQL
- `PersistentVolumeClaim` for uploaded files
- `Deployment` + `Service` for PostgreSQL with PostGIS
- `Deployment` + `Service` for Redis
- `Deployment` + `Service` for the API
- `Ingress` for the API
- `kustomization.yaml`

## Before deploying

1. Build and push the API image to your registry
2. Update the image in `api.yaml`
3. Replace the placeholder values in `secret.yaml`
4. Change the ingress host in `ingress.yaml`
5. Adjust storage classes or add `storageClassName` if your cluster requires it

## Deploy

```sh
kubectl apply -k k8s
```

## Verify

```sh
kubectl get all -n hurgelt
kubectl get pvc -n hurgelt
kubectl get ingress -n hurgelt
```

## Notes

- The container still runs `prisma db push` on startup because that is part of the image command.
- The manifests are designed for a simple single-environment setup.
- For production, prefer a managed PostgreSQL/Redis service or a StatefulSet-backed setup.
