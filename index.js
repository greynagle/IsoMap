function handlePrompt(){
    $('#prompt').click(e=>{
        $('footer.prompt').toggleClass('hidden');
        $('div.fade').toggleClass('hidden');
    })
}

const state={
    address:'',
    time:0,
    transit:'',
    key:'',
    origin:[],
    transitMod:{
        WALKING:84,
        BICYCLING:295,
        DRIVING:1200
    },
    magMod:111319,
    initialShift:[],
    dest:{},
    count:0,
    calls:0
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
        travelMode: state.transit
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
    const shiftMagMod=state.magMod*Math.cos(state.origin[0]*3.14159265/180)
    const transitChoice=state.transitMod[state.transit];
    let mag=[];
    let i=0;
    while (i<=11){
        mag.push(state.time*transitChoice/shiftMagMod)
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
        [o[0]+(m[1]*.866),o[1]+(m[1]*.500)],
        [o[0]+(m[2]*.500),o[1]+(m[2]*.866)],
        [o[0],o[1]+m[3]],
        [o[0]-(m[4]*.500),o[1]+(m[4]*.866)],
        [o[0]-(m[5]*.866),o[1]+(m[5]*.500)],
        [o[0]-m[6],o[1]],
        [o[0]-(m[7]*.866),o[1]-(m[7]*.500)],
        [o[0]-(m[8]*.500),o[1]-(m[8]*.866)],
        [o[0],o[1]-m[9]],
        [o[0]+(m[10]*.500),o[1]-(m[10]*.866)],
        [o[0]+(m[11]*.866),o[1]-(m[11]*.500)]
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
        state.initialShift[i]=(state.initialShift[i] + state.initialShift[i]*(1+percentDifference[i]))/2;
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
      fillColor: '#f5cdb3',
      fillOpacity: 0.35
    });
    isochrone.setMap(map);
  }

function main() {
    handlePrompt();
    handleAddress();
    handleTime();
    handleTransit();
    handleSubmit();

}

$(main)