Repeater allows you to run Brightsec scans without exposing your ports outside. 
Also, it can be useful, if you want to run a local scan without deploying.
  
Add helm repository command:

```sh
$ helm repo add bright-cli https://neuralegion.github.io/bright-cli/
```

Update helm repository:

```sh
$ helm repo update
```

Install helm chart:

```sh
  $ helm upgrade bright-cli --install bright-cli/repeater \ 
      --set repeaterID= \
      --set token= \
```

Default cluster being used is "app.brightsec.com". For different cluster you can use additional --cluster "cluster_name" flag.
  
