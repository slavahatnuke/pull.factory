# pull.factory
The simplest factory Promise based

```javascript

const pullFactory = new PullFactory(() => {
  const service = new Service();
  
  service.setup(1,2,3)
  service.start()

  return service
});

pullFactory.setDestructor((service) => service.stop());
pullFactory.setLimit(2);

pullFactory.use((service1) => service.doSomething())
pullFactory.use((service2) => service.doSomething())

pullFactory.use((service1) => service.doSomething())

```