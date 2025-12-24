package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.Calendar;
import java.util.Date;
import java.util.List;

import com.pace2020.epace.object.Employee;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * Created by IntelliJ IDEA. User: jduval Date: Feb 2, 2005 Time: 2:57:41 PM
 */
public class EmployeeSignInSignOutSample extends SecuredWSDLClient
{

    public static void main( String[] args ) throws Exception
    {
        EmployeeSignInSignOutSample datacollection = new EmployeeSignInSignOutSample();
        datacollection.run();
    }

    private void run() throws RemoteException
    {
        //Find all Employees in department 001
        final List<String> keys = getFindObjectsPortType().find( "Employee", "@department = '001'" ).getString();

        final Calendar calendar = Calendar.getInstance();
        calendar.setTime( new Date() );
        final Calendar calendar2 = Calendar.getInstance();
        calendar2.setTime( new Date() );
        calendar2.add( Calendar.HOUR, 1 );

        //For each employee in department 001, sign them in if they are not signed in.
        for( final String key : keys )
        {
            Employee e = new Employee();

            e.setId( key );

            e = getReadObjectPortType().readEmployee( e );

            if( !e.isSignedIn().booleanValue() )
            {
                getInvokeActionPortType().employeeSignIn( e );
            }
        }
    }
}