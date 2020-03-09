const state={
    address:'',
    time:0,
    transit:'',
    key:'',
    origin:[],
    transitMod:84,
    magMod:111319,
    initialShift:[],
    dest:{},
    count:0,
    calls:3
}

function handleAddress(){
    $('#address').change(e => {
        e.preventDefault();
        return state.address=e.target.value;
    })
}

// function handleKey(){
//     $('#key').change(e =>{
//         e.preventDefault()
//         return state.key=e.target.value
//     })
// }

function handleTime(){
    $('#time').change(e => {
        e.preventDefault();
        if (e.target.value>450 || e.target.value<1){
            alert('Driving time must be between 1  and 450 minutes')
            return state.time=60
        } else{
            return state.time=e.target.value;
        }
    })
}

function handleTransit(){
    $('input[type="radio"]').change(e => {
        e.preventDefault();
        return state.transit=e.target.value;
    })
}

function handleSubmit(){
    $('input[type="submit"]').click(e=>{
        e.preventDefault();
        getOrigin();
    })
}


function getOrigin(){
    fetch('./key.txt')
        .then(response => response.text())
        .then(responseText => {
            state.key=responseText
            getGeocode();
        })
        .catch(error => console.error(error));
}

// aquires the coordinates of the origin of the isochrone
function getGeocode(){
    const subAddress=state.address.split(' ').join('+')
    let query=`https://maps.googleapis.com/maps/api/geocode/json?address=${subAddress}&key=${state.key}`

    fetch(query)
        .then(response => response.json())
        .then(responseJson => {
            // console.log(responseJson)
            state.origin=[responseJson.results[0].geometry.location.lat,responseJson.results[0].geometry.location.lng];
            // console.log(state.origin)
            getMatrix(minToMod());
        })
        .catch(error => console.error(error));
}

// calls the distance matrix services (because CORS and client side silliness) to get distances for adjusting coordinates
function getMatrix(){
    const dest=destGrid(state.origin,state.initialShift)
    state.dest=dest;
    const service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
    {
        origins: [{lat:state.origin[0],lng:state.origin[1]}],
        destinations: dest,
        travelMode: 'DRIVING'
    }, callback);
}

// sorts the distancematrix response and if above a certain percentage incorrect, recalls the getMatrix function to adjust
function callback(response, status) {
    if (status == 'OK') {
        // console.log(response)
        // console.log(response.rows[0].elements)
        let responseValues=response.rows[0].elements.map(val => {
            return (val.duration.value)/60;
        })
        // console.log(responseValues)

        if (state.count<state.calls && acceptDest(responseValues)){
            adjustMagnitude(responseValues);
            state.count++;
            getMatrix()
        } else {
            state.count=0;
            initMap();
        }
    }
  }

// for the first guess at distances
function minToMod(){
    const shiftMagMod=state.magMod*Math.cos(Math.abs(state.origin[0])*3.14159265/180)
    let mag=[];
    let i=0;
    while (i<=7){
        mag.push(state.time*state.transitMod/shiftMagMod)
        i++
    }
    // console.log(mag)
    state.initialShift=mag;
}

// generates the cardinal and half cardinal coordinates for the maps
function destGrid(o,m){    
    // console.log(m)
    let grid=[
        [o[0]+m[0],o[1]],
        [o[0]+(m[1]*.707),o[1]+(m[1]*.707)],
        [o[0],o[1]+m[2]],
        [o[0]-(m[3]*.707),o[1]+(m[3]*.707)],
        [o[0]-m[4],o[1]],
        [o[0]-(m[5]*.707),o[1]-(m[5]*.707)],
        [o[0],o[1]-m[6]],
        [o[0]+(m[7]*.707),o[1]-(m[7]*.707)]
    ]
    return grid.reduce((acc,val)=>{
        return [...acc, {lat:val[0],lng:val[1]}]
    },[])
}

// should we itterate again
function acceptDest(val) {
    let doOver=[]
    for (let i=0; i<val.length;i++){
        if (Math.abs(val[i]-state.time)/state.time<.05){
            doOver.push(false)
        } else {
            doOver.push(true)
        }
    }
    return doOver.includes(true)
}

// new magnitude for narrowing in on correct limits
function adjustMagnitude(resVal){
    let percentDifference=[]
    for (let i=0; i<resVal.length;i++){
        percentDifference.push((state.time-resVal[i])/state.time)
    }
    // console.log(percentDifference)
    for (let i=0; i<percentDifference.length;i++){
        state.initialShift[i]=state.initialShift[i]*(1+percentDifference[i]);
    }
}

function initMap() {
    // console.log('got here')
    let map = new google.maps.Map(document.getElementById('map'), {
      zoom: 15,
      center: {lat:state.origin[0],lng:state.origin[1]},
      mapTypeId: 'terrain'
    });

    let marker = new google.maps.Marker({position:{lat:state.origin[0],lng:state.origin[1]},map:map})
  
    // Construct the polygon.
    let isochrone = new google.maps.Polygon({
      paths: state.dest,
      strokeColor: '#FF0000',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#FF0000',
      fillOpacity: 0.35
    });
    isochrone.setMap(map);
  }

function main() {
    // handleKey();
    handleAddress();
    handleTime();
    handleTransit();
    handleSubmit();

}

$(main)