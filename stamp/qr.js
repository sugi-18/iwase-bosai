function goStamp(){


const params =
new URLSearchParams(
window.location.search
);



const trainingData = {


date:
params.get("date"),


name:
params.get("name"),


detail:
params.get("detail")


};



localStorage.setItem(

"qrTraining",

JSON.stringify(trainingData)

);



location.href="index.html";


}
