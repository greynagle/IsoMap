// Listens for clicking the load-in screen continue prompt
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
    calls:7
}

// listener for origin input
function handleAddress(){
    $('#address').change(e => {
        e.preventDefault();
        return state.address=e.target.value;
    })
}

// listener for time input
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

// listener for travel type
function handleTransit(){
    $('input[type="radio"]').change(e => {
        e.preventDefault();
        return state.transit=e.target.value;
    })
}

// listener for submit click
function handleSubmit(){
    $('input[type="submit"]').click(e=>{
        e.preventDefault();
        getOrigin();
    })
}

// runs on submit
function getOrigin(){
    fetch('./key.txt')
        .then(response => response.text())
        .then(responseText => {
            state.key=responseText
            getGeocode();
        })
        .catch(error => alert(`Sorry, looks like something went wrong. The error is: ${error}`));
}

// aquires the coordinates of the origin of the isochrone
function getGeocode(){
    const subAddress=state.address.split(' ').join('+')
    let query=`https://maps.googleapis.com/maps/api/geocode/json?address=${subAddress}&key=${state.key}`
    if(state.address!=='' && state.time!==0 && state.transit !==''){
        fetch(query)
        .then(response => response.json())
        .then(responseJson => {
            if (responseJson.status !=="ZERO_RESULTS"){
                state.origin=[responseJson.results[0].geometry.location.lat,responseJson.results[0].geometry.location.lng];
                getMatrix(minToMod());
            } else {
                alert(`Seems that address counldn't be found. Please try again with another address.`)
            }
            
        })
        .catch(error => console.error(error));
    } else {
        alert('Please fill in all fields properly')
    }
    
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
        let responseValues=response.rows[0].elements.map((val, ind) => {
            if(val.status==="ZERO_RESULTS"){
                return state.time*2.5;
            } else {
                return (val.duration.value)/60;
            }
        })

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
    state.initialShift=mag;
}

// generates the cardinal and third-cardinal coordinates for the maps
function destGrid(o,m){    
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
    for (let i=0; i<percentDifference.length;i++){
        state.initialShift[i]=(state.initialShift[i] + state.initialShift[i]*(1+percentDifference[i]))/2;
    }
}

// generates the image of the map and related map objects
function initMap() {
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

    // autozoom the map to fit most of the isochrone
    let bounds=state.dest.reduce((acc, val) =>{
        return[[Math.min(acc[0][0], Math.abs(val.lat)), Math.min(acc[0][1], Math.abs(val.lng))],[Math.max(acc[1][0], Math.abs(val.lat)), Math.max(acc[1][1], Math.abs(val.lng))]]
    },[[Infinity,Infinity],[-Infinity, -Infinity]])

    const sign=[state.origin[0]/Math.abs(state.origin[0]), state.origin[1]/Math.abs(state.origin[1])]

    bounds=[{lat:bounds[0][0]*sign[0],lng:bounds[0][1]*sign[1]},{lat:bounds[1][0]*sign[0],lng:bounds[1][1]*sign[1]}]
    let fitBounding=new google.maps.LatLngBounds();
    fitBounding.extend(bounds[0])
    fitBounding.extend(bounds[1])
    // [{lat:bounds[0][0], lng:bounds[0][1]},{lat:bounds[1][0], lng:bounds[1][1]}]
    map.fitBounds(fitBounding);
  }

function main() {
    handlePrompt();
    handleAddress();
    handleTime();
    handleTransit();
    handleSubmit();

}

$(main)