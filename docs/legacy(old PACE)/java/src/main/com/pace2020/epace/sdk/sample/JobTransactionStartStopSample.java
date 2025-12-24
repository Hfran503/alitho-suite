package com.pace2020.epace.sdk.sample;

import java.math.BigDecimal;
import java.rmi.RemoteException;
import java.util.Date;
import java.util.GregorianCalendar;
import javax.xml.datatype.DatatypeConfigurationException;
import javax.xml.datatype.DatatypeFactory;

import com.pace2020.epace.object.Employee;
import com.pace2020.epace.object.Job;
import com.pace2020.epace.object.JobCost;
import com.pace2020.epace.object.JobPart;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * Created by IntelliJ IDEA. User: jduval Date: Feb 2, 2005 Time: 2:57:41 PM
 */
public class JobTransactionStartStopSample extends SecuredWSDLClient
{
    private final String m_employeeId;
    private final String m_activityCode;

    public JobTransactionStartStopSample( final String employeeId, final String activityCode )
    {
        m_employeeId = employeeId;
        m_activityCode = activityCode;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 4 parameters passed in
        if( args.length != 4 )
        {
            throw new Exception( "Usage: CreateJob <CUSTCODE> <QTYORDERED> <EMPLOYEEID> <ACTIVITYCODE>" );
        }
        else
        {
            final CreateJob createJob = new CreateJob( args[0], args[1] );
            final Job returnedJob = createJob.run();

            final JobTransactionStartStopSample jobTransactionSample = new JobTransactionStartStopSample( args[2], args[3] );
            jobTransactionSample.run( returnedJob );

        }
    }

    private void run ( Job job ) throws RemoteException,DatatypeConfigurationException
    {
        Employee employee = new Employee();
        employee.setId( m_employeeId );
        employee = getReadObjectPortType().readEmployee( employee );

        final GregorianCalendar gc = new GregorianCalendar();

                gc.setTime( new Date() );


        JobPart part = new JobPart();
        part.setJob( job.getJob() );
        part.setJobPart( "01" );
        part = getJobPart( part.getJobPart(), job );


        JobCost jobTran = new JobCost();
        jobTran.setJob( job.getJob() );
        jobTran.setJobPart( part.getJobPart() );
        jobTran.setActivityCode( m_activityCode );
        jobTran.setTransactionType( new Integer(1) );
        jobTran.setStartDate( DatatypeFactory.newInstance().newXMLGregorianCalendar( gc ) );
        jobTran.setStartTime( DatatypeFactory.newInstance().newXMLGregorianCalendar( gc ) );
        jobTran.setBeginCount( new Double( "1" ) );
        jobTran.setEndCount( new Double ( "99" ) );
        jobTran.setBeginMeter( new BigDecimal ( "99" ) );
        jobTran.setEndMeter( new BigDecimal ( "50" ) );
        jobTran = getCreateObjectPortType().createJobCost( jobTran );

        getUpdateObjectPortType().updateJobCost( jobTran );

        JobCost jobTranClose = new JobCost();
        jobTranClose.setId( jobTran.getId() );
        jobTranClose = getReadObjectPortType().readJobCost( jobTranClose );
        jobTranClose.setEndDate( DatatypeFactory.newInstance().newXMLGregorianCalendar( gc ) );
        jobTranClose.setStopTime( DatatypeFactory.newInstance().newXMLGregorianCalendar( gc ) );
        getUpdateObjectPortType().updateJobCost( jobTranClose );
    }
}