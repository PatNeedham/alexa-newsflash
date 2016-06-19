**Note:** formerly known as `iod-node`. For the older version, see the `iod` branch.

# Node JS client library for Haven OnDemand
Official client library to help with calling Haven OnDemand APIs [http://havenondemand.com](http://havenondemand.com).

## What is Haven OnDemand?
Haven OnDemand is a set of over 60 APIs for handling all sorts of unstructured data. Here are just some of our APIs' capabilities:
* Speech to text
* OCR
* Text extraction
* Indexing documents
* Smart search
* Language identification
* Concept extraction
* Sentiment analysis
* Web crawlers
* Machine learning

For a full list of all the APIs and to try them out, check out https://www.havenondemand.com/developer/apis

### Installation
To install, run the following command:
```
npm install havenondemand
```
If you want to install the latest module directly from Github, use the following command:
```
npm install git+https://github.com/HP-Haven-OnDemand/havenondemand-node
```

### Include it
```js
var havenondemand = require('havenondemand')
var client = new havenondemand.HODClient(apikey, version, proxy)
```
You can find your API key [here](https://www.haveondemand.com/account/api-keys.html) after signing up.

`version` is an optional parameter (defaults to `'v1'`) and can be either `'v1'` or `'v2'`.

`proxy` is an optional parameter. Please set this if you're behind a firewall. Here is an example of iniating the client if you're using a proxy:
```js
var havenondemand = require('havenondemand')
var client = new havenondemand.HODClient('123456-asdf', 'v1', 'http://user:pass@proxy.server.com:3128')
```
### Callbacks

```js
var callback = function(err,resp,body){
  console.log(body)
}
```

We can define our callbacks as functions and pass them as arguments

```js
var data = {'text' : 'I like cats'}
client.call('analyzesentiment', callback, data)
```
Or, we can use the .on('data') hook to do the same thing.

```js
client.call('analyzesentiment',data).on('data',callback)
```

The order of the arguments after the API name doesn't matter when passed, so all of these are the equivalent.

```js
//1
client.call('analyzesentiment', data, callback)
//2
client.call(data, 'analyzesentiment', callback)
//3
client.call(data, callback, 'analyzesentiment')
```


### Async calls

While node will mostly deals with processes asynchronously, Haven OnDemand offers server side asynchronous call methods which should be used with large files and slow queries. Pass a boolean for the async parameter. The API response will return back a job ID which is used to check the status or result of your API request.
```js
var jobID
client.call('analyzesentiment', data, true, function(err, resp, body) {
  jobID = resp.body.jobID
  console.log(jobID)
})
```
**(Recommended method)** To check the status of your API call, use the following code with the jobID from obtained from the async call above. This will tell you if it's still processing or if it's complete, and if so, it will return the result.
```js
client.getJobStatus(jobID, function(err, resp, body) {
  console.log(resp.body)
})
```
Or, to check the result of your API call, use the following code with the jobID obtained from the async call. *Note: This method may timeout if your async API call is still processing.*
```js
client.getJobResult(jobID, function(err, resp, body) {
  console.log(resp.body)
})
```

### Posting files

File posting is handled using the "file" parameter name which is used for all current file postings in Haven OnDemand

```js
var data = {'file' : 'test.txt'}
client.call('analyzesentiment', data, function(err, resp, body) {
  console.log(resp.body)
})
```

## Contributing
We encourage you to contribute to this repo! Please send pull requests with modified and updated code.

1. Fork it ( https://github.com/HPE-Haven-OnDemand/havenondemand-node/fork )
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create a new Pull Request
