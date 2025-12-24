<?php

function showALL($value) {
  if ($value) 
    foreach ($value as $keya=>$valb) 
      print "$keya=$valb<br>";
  else
    print "No values to display. <br>";
}

function makeProxyObject($name, $structString)
{
   #echo "name: $name <BR>";
   #echo "struct: $structString <BR>";
   
	$OBJECT_NAME = substr($structString, 7, strpos($structString,'{') - 8);
	$OBJECT_STRUCT_STR = trim(trim(trim( strstr($structString, '{') , '{}' )),';');
	#var_dump($OBJECT_STRUCT_STR); echo "<BR><BR>";
	$SCHEMA_ARR = explode(';', $OBJECT_STRUCT_STR );

	$RESULT_OBJ = new stdClass;

	foreach ($SCHEMA_ARR as $a) {

		$element = explode(' ', trim($a));
		$dataType = $element[0];
		$fieldName = $element[1];

		if ($dataType == "boolean") {
			$RESULT_OBJ->$fieldName=False;
		}
		else {
		$RESULT_OBJ->$fieldName="";
		}

	}
	return $RESULT_OBJ;
}

class ReadObjectHelper
{
  var $soapclient;
  var $typeStructs; 

	 
  function ReadObjectHelper()
  {
  
	$wsdl_location = "http://".$GLOBALS['apiusername'].":".$GLOBALS['apipassword']."@".$GLOBALS['epacehost']."/rpc/services/ReadObject?wsdl";
	$location = "http://".$GLOBALS['epacehost']."/rpc/services/ReadObject"; 
	
    $this->soapclient = new SoapClient($wsdl_location, array("trace"=> 1,'login' => $GLOBALS['apiusername'], 'password' => $GLOBALS['apipassword'], 'location' => $location));  
	$this->typeStructs = $this->soapclient->__getTypes() ;	
  }
  
  function getObject($objectname, $pkfield, $value) {
	
	
	$OBJ_NAME = ucfirst($objectname);
	$PROX = makeProxyObject($OBJ_NAME, current(preg_grep("/struct $OBJ_NAME {/", $this->typeStructs)));

	$funcName= "read". $OBJ_NAME;
  	
	//echo "pkfield = $pkfield <BR>";
	$PROX->$pkfield=$value;
	
	$obj = $this->soapclient->$funcName( array($objectname => (array) $PROX ));
	$return_object = $obj->out;
	
	foreach (array_keys((array)$PROX) as $property ) {
	
	
	 if ( ! property_exists($return_object, $property)) {
	     $return_object->$property=$PROX->$property;
	
	}}
	
    return $return_object;
	
  }
  
  function getObjectByOperation($objectname, $pkfield, $value, $funcName) {
  	$obj = $this->soapclient->$funcName( array($objectname => array ($pkfield => $value )));
	 return $obj->out;
  }
  function getCompositeKeyObject($key, $arr, $funcName) {
    $obj = $this->soapclient->$funcName( array($key => $arr));
    return $obj->out;
  }

  function debug() {
  
     echo "<BR><BR>";
     echo "BEGIN DEBUG<BR>";
      echo htmlentities($this->soapclient->__getLastRequest());
echo "<BR><BR>";
		
	echo htmlentities($this->soapclient->__getLastResponse());
	
	
	echo "<BR><BR>";
	echo "END DEBUG<BR>";
  }

  function createLocalObject( $objectType, $key, $value )  {

    $newObj = makeProxyObject($objectType, current(preg_grep("/struct $objectType {/", $this->typeStructs)));
    $newObj->$key=$value;
    return $newObj;
  }

}

class CreateObjectHelper
{
  
  var $soapclient;
  function CreateObjectHelper()
  {
    
	$location = "http://".$GLOBALS['epacehost']."/rpc/services/CreateObject";
    $this->soapclient = new SoapClient("http://".$GLOBALS['apiusername'].":".$GLOBALS['apipassword']."@".$GLOBALS['epacehost']."/rpc/services/CreateObject?wsdl", array("trace"=> 1,'login' => $GLOBALS['apiusername'], 'password' => $GLOBALS['apipassword'], 'location' => $location));   

  }
  
  function createObject($key, $value, $funcName) {
    
    $obj = $this->soapclient->$funcName( array($key => $value));
    
    /*
     foreach ($returnObj as $key=>$val) {
     if ($val == "false") {
     $returnObj[ $key ] = "0";
     }
     }	
    */
    
    return $this->object2array( $obj->out );
  }   
  
  function object2array($object) {
    if (is_object($object)) {
      foreach ($object as $key => $value) {
        $array[$key] = $value;
        
        //        print "$key=$value<br>";
      }
    }
    else {
      
      $array = $object;
    }
    return $array;
  }
  function debug() {
      echo htmlentities($this->soapclient->__getLastRequest());
  }
  
}

class DeleteObjectHelper
{
  var $soapclient;
  function DeleteObjectHelper()
  {
    $location = "http://".$GLOBALS['epacehost']."/rpc/services/DeleteObject";
    $this->soapclient = new SoapClient("http://".$GLOBALS['apiusername'].":".$GLOBALS['apipassword']."@".$GLOBALS['epacehost']."/rpc/services/DeleteObject?wsdl", array("trace"=> 1,'login' => $GLOBALS['apiusername'], 'password' => $GLOBALS['apipassword'], 'location' => $location));      
  }

  function deleteObject($object, $id) {

    $obj = $this->soapclient->deleteObject( array ('in0' => $object, 'in1' => $id ) );
  }
   function debug() {
      echo htmlentities($this->soapclient->__getLastRequest());
  }
  

}


class UpdateObjectHelper
{
  var $soapclient;
  function UpdateObjectHelper()
  {
    $location = "http://".$GLOBALS['epacehost']."/rpc/services/UpdateObject";
    $this->soapclient = new SoapClient("http://".$GLOBALS['apiusername'].":".$GLOBALS['apipassword']."@".$GLOBALS['epacehost']."/rpc/services/UpdateObject?wsdl", array("trace"=> 1,'login' => $GLOBALS['apiusername'], 'password' => $GLOBALS['apipassword'], 'location' => $location));      
  }
  function updateObject($key, $value, $funcName) {
    $obj = $this->soapclient->$funcName( array($key => $value));
  }   
  function setGLAccount($glAccount)
  {
    $this->soapclient->updateGLAccount( array('gLAccount' => $glAccount) );
  }
  
  function debug() {
      echo htmlentities($this->soapclient->__getLastRequest());
  }
  
}


class FindObjectsHelper
{
  var $soapclient;
  
  function FindObjectsHelper()
  {
    $location = "http://".$GLOBALS['epacehost']."/rpc/services/FindObjects";
    $this->soapclient = new SoapClient("http://".$GLOBALS['apiusername'].":".$GLOBALS['apipassword']."@".$GLOBALS['epacehost']."/rpc/services/FindObjects?wsdl", array("trace"=> 1,'login' => $GLOBALS['apiusername'], 'password' => $GLOBALS['apipassword'], 'location' => $location));
    
  }
  
  
  function getObjects($object, $filter)
  {
    
    $ret = $this->soapclient->find(array('in0' => $object,'in1' => $filter ));
    return $ret->out->string;
  }
  
  function getObjectList($descriptor)
  { 
    $ret = $this->soapclient->loadValueObjects( array('in0' => $descriptor ));
    return $ret->out;
  }

  function debug() {
      echo htmlentities($this->soapclient->__getLastRequest());
  }
  
}

class InvokeActionHelper
{
    var $soapclient;

    function InvokeActionHelper()
    {
        $location = "http://".$GLOBALS['epacehost']."/rpc/services/InvokeAction";
        $this->soapclient = new SoapClient("http://".$GLOBALS['apiusername'].":".$GLOBALS['apipassword']."@".$GLOBALS['epacehost']."/rpc/services/InvokeAction?wsdl", array("trace"=> 1,'login' => $GLOBALS['apiusername'], 'password' => $GLOBALS['apipassword'], 'location' => $location));
    }

    function calculateEstimate( $est )
    {
        $ret = $this->soapclient->calculateEstimate(array('in0' => $est));
        return $ret->out;
    }

    function getEstimateConvertToJob( $est )
    {
        $ret = $this->soapclient->getEstimateConvertToJob(array('in0' => $est));
        return $ret->out;
    }

    function convertEstimateToJob( $estConvertToJob )
    {
        $ret = $this->soapclient->convertEstimateToJob(array('in0' => $estConvertToJob));
        return $ret->out;
    }
    function createEstimate( $est )
	{
		$ret = $this->soapclient->createEstimate(array('in0' => $est));
		return $ret->out;
    }
}

class CloneObjectHelper
{
    var $soapclient;
    var $typeStructs;

    function CloneObjectHelper()
    {
        $location = "http://".$GLOBALS['epacehost']."/rpc/services/CloneObject";
        $this->soapclient = new SoapClient("http://".$GLOBALS['apiusername'].":".$GLOBALS['apipassword']."@".$GLOBALS['epacehost']."/rpc/services/CloneObject?wsdl", array("trace"=> 1,'login' => $GLOBALS['apiusername'], 'password' => $GLOBALS['apipassword'], 'location' => $location));
        $this->typeStructs = $this->soapclient->__getTypes() ;
    }

    function cloneJob( $actionName, $object, $newObject )
    {
        //$ret = $this->soapclient->$actionName(array('Job' => $object,'in1' => null, 'in2' => null, 'in3' => $newObject ));
        $ret = $this->soapclient->$actionName(array('Job' => $object,'newPrimaryKey' => null, 'newParent' => null, 'JobAttributesToOverride' => $newObject ));
        return $ret->out;
    }

    function cloneObject( $actionName, $objectType, $object, $newObject )
    {
        $ret = $this->soapclient->$actionName(array($objectType => $object,'newPrimaryKey' => null, 'newParent' => null, $objectType.'AttributesToOverride' => $newObject ));
        return $ret->out;
    }
}
class AttachmentServiceObjectHelper
{
  var $soapclient;
  function AttachmentServiceObjectHelper()
  {
    $location = "http://".$GLOBALS['epacehost']."/rpc/services/AttachmentService";
    $this->soapclient = new SoapClient("http://".$GLOBALS['apiusername'].":".$GLOBALS['apipassword']."@".$GLOBALS['epacehost']."/rpc/services/AttachmentService?wsdl", array("trace"=> 1,'login' => $GLOBALS['apiusername'], 'password' => $GLOBALS['apipassword'], 'location' => $location));
  }

  function addAttachment($baseObject, $primaryKey , $attachment) {

    $obj = $this->soapclient->addAttachment( array( 'in0' => $baseObject, 'in1' => $primaryKey , 'in2' => null , 'in3' => $attachment) );
    return $obj->out;
  }

    function readAttachment($attachmentKey) {

      $obj = $this->soapclient->getAttachmentFromKey( array( 'in0' => $attachmentKey) );
      return $obj->out;
  }

}
?>